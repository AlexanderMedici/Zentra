import { Inngest } from 'inngest';

// Configure multiple AI providers for Inngest step.ai
// - Gemini via GEMINI_API_KEY (existing)
// - OpenAI via OPENAI_API_KEY (new)
export const inngest = new Inngest({
  id: 'finsage',
  ai: {
    gemini: { apiKey: process.env.GEMINI_API_KEY },
    openai: { apiKey: process.env.OPENAI_API_KEY },
  },
});
