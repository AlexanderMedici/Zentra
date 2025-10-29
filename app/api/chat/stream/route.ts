import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { ChatMessageModel } from '@/database/models/chat.model';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get('threadId');
  const timeoutMs = Math.min(parseInt(url.searchParams.get('timeout') || '25000', 10) || 25000, 60000);

  if (!threadId) return new Response('threadId required', { status: 400 });

  try {
    await connectToDatabase();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    // Establish baseline: last assistant message time at connection start
    const latest = await ChatMessageModel.findOne({ threadId, userId: session.user.id, role: 'assistant' })
      .sort({ createdAt: -1 })
      .lean();
    // Use a small time buffer if no prior assistant message exists
    // to avoid missing messages created at the same instant as connect.
    let lastSeen = latest?.createdAt
      ? new Date(latest.createdAt)
      : new Date(Date.now() - 5000);

    let closed = false;
    // Timer refs captured for cleanup in both start() and cancel()
    let heartbeat: any;
    let poller: any;
    let killer: any;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();

        const cleanup = () => {
          if (heartbeat) clearInterval(heartbeat);
          if (poller) clearInterval(poller);
          if (killer) clearTimeout(killer);
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {}
        };

        const send = (event: string, data?: any) => {
          if (closed) return;
          try {
            const payload =
              data !== undefined
                ? `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                : `event: ${event}\n\n`;
            controller.enqueue(enc.encode(payload));
          } catch {}
        };

        // Heartbeat every 10s
        heartbeat = setInterval(() => send('ping'), 10000);

        // Poll DB for new assistant messages since lastSeen
        const tick = async () => {
          if (closed) return;
          try {
            const fresh = await ChatMessageModel.find({
              threadId,
              userId: session.user.id,
              role: 'assistant',
              createdAt: { $gt: lastSeen },
            })
              .sort({ createdAt: 1 })
              .lean();

            if (fresh && fresh.length > 0) {
              for (const m of fresh) {
                send('message', { _id: String(m._id), role: m.role, content: m.content, createdAt: m.createdAt });
                lastSeen = new Date(m.createdAt as any);
              }
              // Close after first batch to let client re-open if needed
              cleanup();
              safeClose();
              return;
            }
          } catch (e) {
            // On error, close quietly
            cleanup();
            safeClose();
          }
        };

        poller = setInterval(tick, 600);
        // Initial quick check
        tick();

        killer = setTimeout(() => {
          if (closed) return;
          cleanup();
          safeClose();
        }, timeoutMs);
      },
      cancel() {
        // Called when the client disconnects. Ensure timers are cleared and state is marked closed.
        if (closed) return;
        if (heartbeat) clearInterval(heartbeat);
        if (poller) clearInterval(poller);
        if (killer) clearTimeout(killer);
        closed = true;
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  } catch (e) {
    console.error('GET /api/chat/stream failed', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

