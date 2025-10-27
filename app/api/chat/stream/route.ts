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
    let lastSeen = latest?.createdAt ? new Date(latest.createdAt) : new Date();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        let closed = false;

        const send = (event: string, data?: any) => {
          if (closed) return;
          const payload = data !== undefined ? `event: ${event}\ndata: ${JSON.stringify(data)}\n\n` : `event: ${event}\n\n`;
          controller.enqueue(enc.encode(payload));
        };

        // Heartbeat every 10s
        const heartbeat = setInterval(() => send('ping'), 10000);

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
              clearInterval(heartbeat);
              clearInterval(poller);
              closed = true;
              controller.close();
              return;
            }
          } catch (e) {
            // On error, close quietly
            clearInterval(heartbeat);
            clearInterval(poller);
            closed = true;
            controller.close();
          }
        };

        const poller = setInterval(tick, 600);
        // Initial quick check
        tick();

        const killer = setTimeout(() => {
          if (closed) return;
          clearInterval(heartbeat);
          clearInterval(poller);
          closed = true;
          controller.close();
        }, timeoutMs);

        // Cleanup on cancel
        // @ts-ignore
        controller.signal?.addEventListener?.('abort', () => {
          clearInterval(heartbeat);
          clearInterval(poller);
          clearTimeout(killer);
          closed = true;
        });
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

