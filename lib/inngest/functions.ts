import { inngest } from '@/lib/inngest/client';
import { PERSONALIZED_WELCOME_EMAIL_PROMPT } from "@/lib/inngest/prompts";
import { sendWelcomeEmail } from "@/lib/nodemailer";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const safe = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? v : '—');

        const userProfile = `
            - Country: ${safe(event.data.country)}
            - Investment goals: ${safe(event.data.investmentGoals)}
            - Risk tolerance: ${safe(event.data.riskTolerance)}
            - Preferred industry: ${safe(event.data.preferredIndustry)}
        `;

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile);

        let introText: string = 'Thanks for joining Finsage. You now have the tools to track markets and make smarter moves.';

        try {
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
            });

            const part = response.candidates?.[0]?.content?.parts?.[0] as unknown;
            // Extract text safely from AI response
            // @ts-expect-error runtime safety
            const textCandidate = part && typeof part === 'object' && 'text' in part ? (part as any).text : null;
            if (typeof textCandidate === 'string' && textCandidate.trim().length > 0) {
                introText = textCandidate;
            }
        } catch (err) {
            await step.run('log-ai-failure', async () => {
                console.error('AI intro generation failed:', err);
            });
        }

        await step.run('send-welcome-email', async () => {
            const clean = (v?: string) => (typeof v === 'string' ? v.trim() : '');
            const { data: { email, name } } = event;
            const to = clean(email);
            const displayName = clean(name);

            if (!to) {
                console.error('Welcome email skipped: missing recipient email in event payload', { data: event.data });
                throw new Error('Missing recipient email');
            }

            try {
                await sendWelcomeEmail({ email: to, name: displayName, intro: introText });
            } catch (err) {
                console.error('Failed to send welcome email:', err);
                throw err;
            }
        });

        return {
            success: true,
            message: 'Welcome email sent successfully'
        };
    }
)
