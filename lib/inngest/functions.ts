import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendWelcomeEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail } from "@/lib/actions/watchlist.actions";
import { getNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { connectToDatabase } from '@/database/mongoose';
import { ChatMessageModel } from '@/database/models/chat.model';

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
            const provider = (process.env.FINSAGE_CHAT_PROVIDER || '').toLowerCase();
            const preferOpenAI = provider === 'openai' || (!provider && !!process.env.OPENAI_API_KEY);
            const modelName = process.env.FINSAGE_CHAT_MODEL || (preferOpenAI ? 'gpt-4o-mini' : 'gemini-2.5-flash-lite');

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
