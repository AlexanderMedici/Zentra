import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const rawProvider = (process.env.FINSAGE_CHAT_PROVIDER || '').toLowerCase();
    const providerEnv = rawProvider === 'chatgpt' ? 'openai' : rawProvider;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const preferOpenAI = providerEnv === 'openai' || (!providerEnv && hasOpenAI);
    const provider = preferOpenAI ? 'openai' : 'gemini';
    const rawModel = (process.env.FINSAGE_CHAT_MODEL || '').toLowerCase().replace(/\s+/g, '');
    const model = (() => {
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

    const body = {
      provider,
      model,
      configured: {
        openai: hasOpenAI,
        gemini: hasGemini,
      },
      source: 'env',
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('GET /api/admin/ai failed', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

