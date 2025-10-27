import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { ChatMessageModel, ChatThreadModel } from '@/database/models/chat.model';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    if (!threadId) return new Response('threadId required', { status: 400 });

    const messages = await ChatMessageModel.find({ threadId, userId: session.user.id })
      .sort({ createdAt: 1 })
      .lean();

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('GET /api/chat/messages failed', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const { threadId, text } = await req.json().catch(() => ({ threadId: undefined, text: undefined }));
    if (!text || typeof text !== 'string' || text.trim().length === 0) return new Response('text required', { status: 400 });

    let thread = null as any;
    if (!threadId) {
      thread = await ChatThreadModel.create({ userId: session.user.id, title: text.slice(0, 60) });
    } else {
      thread = await ChatThreadModel.findOne({ _id: threadId, userId: session.user.id });
      if (!thread) return new Response('thread not found', { status: 404 });
    }

    const userMsg = await ChatMessageModel.create({
      threadId: thread._id,
      userId: session.user.id,
      role: 'user',
      content: text,
    });

    await inngest.send({
      name: 'app/chat.ask',
      data: {
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        threadId: String(thread._id),
        text,
      },
    });

    return new Response(
      JSON.stringify({ threadId: String(thread._id), message: { ...userMsg.toObject(), _id: String(userMsg._id) } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('POST /api/chat/messages failed', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
