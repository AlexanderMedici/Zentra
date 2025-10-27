import { Inngest } from 'inngest';

// select ai model you need a key
export const inngest = new Inngest({
  id: 'finsage',
  ai: { gemini: { apiKey: process.env.GEMINI_API_KEY } },
});
