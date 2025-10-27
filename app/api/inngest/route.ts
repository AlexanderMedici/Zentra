
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sendDailyNewsSummary, sendSignUpEmail, processChatMessage } from '@/lib/inngest/functions';

// Inngest only expects GET (health) and POST (invoke). Exporting PUT causes
// empty-body PUTs to throw JSON parsing errors in the serve handler.
export const { GET, POST } = serve({
  client: inngest,
  functions: [sendSignUpEmail, sendDailyNewsSummary, processChatMessage],
});

// Some environments or probes may send a PUT with no body.
// Handle it gracefully to avoid 405 while keeping Inngest wiring intact.
export const PUT = async (req: Request) => {
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev) {
    return new Response('Method Not Allowed', { status: 405 });
  }
  // In dev, allow empty-body PUT from local tools only
  const origin = (req.headers.get('origin') || '').toLowerCase();
  const host = (req.headers.get('host') || '').toLowerCase();
  const isLocal = origin.includes('localhost') || host.includes('localhost') || host.includes('127.0.0.1');
  if (!isLocal) {
    return new Response('Forbidden', { status: 403 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
