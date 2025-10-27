import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const providerEnv = (process.env.FINSAGE_CHAT_PROVIDER || '').toLowerCase();
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const preferOpenAI = providerEnv === 'openai' || (!providerEnv && hasOpenAI);
    const provider = preferOpenAI ? 'openai' : 'gemini';
    const model = process.env.FINSAGE_CHAT_MODEL || (preferOpenAI ? 'gpt-4o-mini' : 'gemini-2.5-flash-lite');

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

