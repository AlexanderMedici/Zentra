import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendWelcomeEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail } from "@/lib/actions/watchlist.actions";
import { getNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { connectToDatabase } from '@/database/mongoose';
import { ChatMessageModel } from '@/database/models/chat.model';
import { AlertModel } from '@/database/models/alert.model';
import { NotificationPreferencesModel } from '@/database/models/notification-preferences.model';
import { sendAlertEmail } from '@/lib/nodemailer';
import { fetchJSON } from '@/lib/actions/finnhub.actions';

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }]
            }
        })

        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) ||'Thanks for joining Finsage. You now have the tools to track markets and make smarter moves.'

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

export const processPriceAlerts = inngest.createFunction(
    { id: 'process-price-alerts' },
    [ { event: 'app/alerts.process' }, { cron: '*/10 * * * *' } ],
    async ({ step }) => {
        const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
        const token = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
        if (!token) return { success: false, message: 'No FINNHUB token' } as const;

        await step.run('db-connect', async () => connectToDatabase());

        const alerts = await step.run('load-active-alerts', async () => {
            return AlertModel.find({ active: { $ne: false } }).lean();
        });

        if (!Array.isArray(alerts) || alerts.length === 0) return { success: true, message: 'No alerts' } as const;

        const symbols = Array.from(new Set((alerts as any[]).map(a => String(a.symbol).toUpperCase())));

        const quotes = await step.run('fetch-quotes', async () => {
            const map: Record<string, number> = {};
            await Promise.all(symbols.map(async (sym) => {
                try {
                    const q: any = await fetchJSON(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(sym)}&token=${token}`);
                    const price = Number(q?.c || 0);
                    if (Number.isFinite(price) && price > 0) map[sym] = price;
                } catch (e) {
                    console.error('quote fail', sym, e);
                }
            }));
            return map;
        });

        const db = (await connectToDatabase()).connection.db!;

        for (const a of alerts as any[]) {
            const sym = String(a.symbol).toUpperCase();
            const price = quotes[sym];
            if (!price) continue;
            const threshold = Number(a.threshold);
            const triggered = a.alertType === 'upper' ? price >= threshold : price <= threshold;
            if (!triggered) continue;

            // Load user email and preferences
            const user = await db.collection('user').findOne({ id: a.userId });
            if (!user?.email) continue;
            const prefs = await NotificationPreferencesModel.findOne({ userId: a.userId }).lean();
            const allowEmail = !!(prefs?.emailAllowed ?? true); // default allow email if not set
            if (!allowEmail) continue;

            const conditionLabel = a.alertType === 'upper' ? `Price >= $${threshold.toFixed(2)}` : `Price <= $${threshold.toFixed(2)}`;
            const symbolUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/stocks/${sym}`;

            await step.run(`email-${a._id}`, async () => {
                await sendAlertEmail({
                    email: user.email,
                    symbol: sym,
                    company: a.company,
                    alertName: a.alertName,
                    conditionLabel,
                    currentPrice: `$${price.toFixed(2)}`,
                    threshold: `$${threshold.toFixed(2)}`,
                    symbolUrl: symbolUrl || '#',
                });
            });

            // Deactivate alert after sending to avoid repeated emails on each run.
            await step.run(`deactivate-${a._id}`, async () => {
                await AlertModel.updateOne(
                    { _id: a._id },
                    { $set: { active: false, lastTriggeredAt: new Date(), lastTriggeredPrice: price } }
                );
            });
        }

        return { success: true } as const;
    }
)

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        // Step #1: Get all users for news delivery
        const users = await step.run('get-all-users', getAllUsersForNewsEmail)

        if(!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        // Step #2: For each user, get watchlist symbols -> fetch news (fallback to general)
        const results = await step.run('fetch-user-news', async () => {
            const perUser: Array<{ user: UserForNewsEmail; articles: MarketNewsArticle[] }> = [];
            for (const user of users as UserForNewsEmail[]) {
                try {
                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    let articles = await getNews(symbols);
                    // Enforce max 6 articles per user
                    articles = (articles || []).slice(0, 6);
                    // If still empty, fallback to general
                    if (!articles || articles.length === 0) {
                        articles = await getNews();
                        articles = (articles || []).slice(0, 6);
                    }
                    perUser.push({ user, articles });
                } catch (e) {
                    console.error('daily-news: error preparing user news', user.email, e);
                    perUser.push({ user, articles: [] });
                }
            }
            return perUser;
        });

        // Step #3: (placeholder) Summarize news via AI
        const userNewsSummaries: { user: UserForNewsEmail; newsContent: string | null }[] = [];

        for (const { user, articles } of results) {
                try {
                    const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

                    const response = await step.ai.infer(`summarize-news-${user.email}`, {
                        model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                        body: {
                            contents: [{ role: 'user', parts: [{ text:prompt }]}]
                        }
                    });

                    const part = response.candidates?.[0]?.content?.parts?.[0];
                    const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.'

                    userNewsSummaries.push({ user, newsContent });
                } catch (e) {
                    console.error('Failed to summarize news for : ', user.email);
                    userNewsSummaries.push({ user, newsContent: null });
                }
            }

        // Step #4: (placeholder) Send the emails
        await step.run('send-news-emails', async () => {
                await Promise.all(
                    userNewsSummaries.map(async ({ user, newsContent}) => {
                        if(!newsContent) return false;

                        return await sendNewsSummaryEmail({ email: user.email, date: getFormattedTodayDate(), newsContent })
                    })
                )
            })

        return { success: true, message: 'Daily news summary emails sent successfully' }
    }
)

// Chat assistant: process user prompts via Inngest AI and save reply
export const processChatMessage = inngest.createFunction(
    { id: 'chat-assistant' },
    { event: 'app/chat.ask' },
    async ({ event, step }) => {
        await connectToDatabase();

        const { userId, userName, userEmail, threadId, text } = event.data as {
            userId: string;
            userName?: string | null;
            userEmail?: string | null;
            threadId: string;
            text: string;
        };
        if (!userId || !threadId || !text) return { success: false, message: 'Invalid chat payload' };

        const history = await step.run('load-history', async () => {
            return ChatMessageModel.find({ threadId }).sort({ createdAt: -1 }).limit(10).lean();
        });

        const assistantCount = (history as any[]).reduce((acc, m) => acc + (m.role === 'assistant' ? 1 : 0), 0);
        const newestAssistant = (history as any[]).find((m) => m.role === 'assistant');
        const newestAssistantTime = newestAssistant ? new Date(newestAssistant.createdAt as any).getTime() : 0;
        const hoursSinceLastAssistant = newestAssistantTime ? (Date.now() - newestAssistantTime) / (1000 * 60 * 60) : Infinity;
        const shouldGreetByTime = hoursSinceLastAssistant >= 12; // greet again if it has been 12+ hours
        const firstName = ((userName || userEmail || 'there') as string).split(' ')[0];
        const system = [
            'You are Finsage, a helpful investing assistant. Keep answers concise and practical.',
            assistantCount === 0 || shouldGreetByTime
                ? `Greet the user by name as "Hello ${firstName}," in your first sentence, then answer.`
                : undefined,
        ]
            .filter(Boolean)
            .join(' ');

        const contents = [
            { role: 'user', parts: [{ text: system }] },
            ...[...(history as any[])].reverse().map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
            { role: 'user', parts: [{ text }] },
        ];

        let reply = 'Sorry, I could not generate a response.';
        try {
            // Choose provider/model for Finsage assistant.
            // Defaults:
            // - OpenAI gpt-4o-mini if OPENAI_API_KEY is present (free-tier friendly)
            // - Otherwise Gemini gemini-2.5-flash-lite
            const rawProvider = (process.env.FINSAGE_CHAT_PROVIDER || '').toLowerCase();
            const provider = rawProvider === 'chatgpt' ? 'openai' : rawProvider;
            const preferOpenAI = provider === 'openai' || (!provider && !!process.env.OPENAI_API_KEY);
            const rawModel = (process.env.FINSAGE_CHAT_MODEL || '').toLowerCase().replace(/\s+/g, '');
            const modelName = (() => {
              if (preferOpenAI) {
                if (!rawModel) return 'gpt-4o-mini';
                if (['chatgpt','chat-gpt','gpt','gpt4','gpt-4','gpt4o','gpt-4o'].includes(rawModel)) return 'gpt-4o';
                if (['gpt-4o-mini','gpt4o-mini','mini'].includes(rawModel)) return 'gpt-4o-mini';
                if (['gpt-3.5-turbo','gpt3.5','gpt-3.5'].includes(rawModel)) return 'gpt-3.5-turbo';
                return process.env.FINSAGE_CHAT_MODEL as string;
              } else {
                if (!rawModel) return 'gemini-2.5-flash-lite';
                if (['gemini','gemini-2.5','gemini2.5','flash','flash-lite'].includes(rawModel)) return 'gemini-2.5-flash-lite';
                return process.env.FINSAGE_CHAT_MODEL as string;
              }
            })();

            const model = preferOpenAI
              ? step.ai.models.openai({ model: modelName })
              : step.ai.models.gemini({ model: modelName });

            let response: any;
            if (preferOpenAI) {
              const messages = [
                { role: 'system', content: system },
                ...[...(history as any[])].reverse().map((m) => ({
                  role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
                  content: m.content,
                })),
                { role: 'user', content: text },
              ];
              response = await step.ai.infer('chat-reply', {
                model,
                body: { messages },
              });
              const fromOutput = (response as any).output_text;
              const fromChoices = (response as any).choices?.[0]?.message?.content;
              const candidate = typeof fromOutput === 'string' && fromOutput.trim().length > 0
                ? fromOutput
                : typeof fromChoices === 'string' && fromChoices.trim().length > 0
                ? fromChoices
                : null;
              if (candidate) reply = candidate;
            } else {
              response = await step.ai.infer('chat-reply', {
                model,
                body: { contents },
              });
              const part = (response as any).candidates?.[0]?.content?.parts?.[0];
              const textCandidate = part && typeof part === 'object' && 'text' in part ? (part as any).text : null;
              if (typeof textCandidate === 'string' && textCandidate.trim().length > 0) reply = textCandidate;
            }
        } catch (e) {
            await step.run('log-ai-failure', async () => console.error('chat-ai failed', e));
        }

        await step.run('save-assistant', async () => {
            await ChatMessageModel.create({ threadId, userId, role: 'assistant', content: reply });
        });

        return { success: true };
    }
)
