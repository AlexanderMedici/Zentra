import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { sendSignUpEmail } from '@/lib/inngest/functions';

// Inngest only expects GET (health) and POST (invoke). Exporting PUT causes
// empty-body PUTs to throw JSON parsing errors in the serve handler.
export const { GET, POST } = serve({
  client: inngest,
  functions: [sendSignUpEmail],
});

// Some environments or probes may send a PUT with no body.
// Handle it gracefully to avoid 405 while keeping Inngest wiring intact.
export const PUT = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
