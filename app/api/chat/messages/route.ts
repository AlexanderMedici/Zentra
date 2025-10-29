import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { ChatMessageModel, ChatThreadModel } from '@/database/models/chat.model';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';

async function generateAssistantReplyLocally(params: {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  threadId: string;
  text: string;
}) {
  const { userId, userName, userEmail, threadId, text } = params;

  try {
    const history = await ChatMessageModel.find({ threadId }).sort({ createdAt: -1 }).limit(10).lean();
    const assistantCount = (history as any[]).reduce((acc, m) => acc + (m.role === 'assistant' ? 1 : 0), 0);
    const newestAssistant = (history as any[]).find((m) => m.role === 'assistant');
    const newestAssistantTime = newestAssistant ? new Date(newestAssistant.createdAt as any).getTime() : 0;
    const hoursSinceLastAssistant = newestAssistantTime ? (Date.now() - newestAssistantTime) / (1000 * 60 * 60) : Infinity;
    const shouldGreetByTime = hoursSinceLastAssistant >= 12;
    const firstName = ((userName || userEmail || 'there') as string).split(' ')[0];
    const system = [
      'You are Finsage, a helpful investing assistant. Keep answers concise and practical.',
      assistantCount === 0 || shouldGreetByTime
        ? `Greet the user by name as "Hello ${firstName}," in your first sentence, then answer.`
        : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    const rawProvider = (process.env.FINSAGE_CHAT_PROVIDER || '').toLowerCase();
    const provider = rawProvider === 'chatgpt' ? 'openai' : rawProvider;
    const preferOpenAI = provider === 'openai' || (!provider && !!process.env.OPENAI_API_KEY);
    const rawModel = (process.env.FINSAGE_CHAT_MODEL || '').toLowerCase().replace(/\s+/g, '');
    const modelName = (() => {
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

    let reply = 'Sorry, I could not generate a response.';

    if (preferOpenAI) {
      const messages = [
        { role: 'system', content: system },
        ...[...(history as any[])].reverse().map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
          content: m.content,
        })),
        { role: 'user', content: text },
      ];

      try {
        const endpoint = 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model: modelName, messages }),
        });
        if (res.ok) {
          const data: any = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.trim().length > 0) reply = content;
        } else {
          let body: any = null;
          try { body = await res.text(); } catch {}
          console.error('openai-chat failed', {
            status: res.status,
            statusText: res.statusText,
            endpoint,
            model: modelName,
            body,
          });
        }
      } catch (e) {
        console.error('openai-chat exception', e);
      }
    } else {
      // Gemini HTTP API
      try {
        const contents = [
          { role: 'user', parts: [{ text: system }] },
          ...[...(history as any[])].reverse().map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text }] },
        ];
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ contents }),
        });
        if (res.ok) {
          const data: any = await res.json();
          const part = data?.candidates?.[0]?.content?.parts?.[0];
          const textCandidate = part && typeof part === 'object' && 'text' in part ? (part as any).text : null;
          if (typeof textCandidate === 'string' && textCandidate.trim().length > 0) reply = textCandidate;
        } else {
          let body: any = null;
          try { body = await res.text(); } catch {}
          console.error('gemini-chat failed', {
            status: res.status,
            statusText: res.statusText,
            endpoint,
            model: modelName,
            body,
          });
        }
      } catch (e) {
        console.error('gemini-chat exception', e);
      }
    }

    await ChatMessageModel.create({ threadId, userId, role: 'assistant', content: reply });
  } catch (e) {
    console.error('local-chat-reply failed', e);
  }
}

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
    const origin = req.headers.get('origin');
    if (origin) {
      try {
        const hdrs = req.headers;
        const expectedHost =
          hdrs.get('x-forwarded-host') ||
          hdrs.get('host') ||
          new URL(req.url).host;
        const originHost = new URL(origin).host;
        if (originHost !== expectedHost) return new Response('Forbidden', { status: 403 });
      } catch {}
    }
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

    // Local fallback: if Inngest isn't configured, generate inline
    const hasInngestKeys = !!process.env.INNGEST_EVENT_KEY || !!process.env.INNGEST_SIGNING_KEY;
    if (!hasInngestKeys) {
      // fire-and-forget; do not block the HTTP response
      generateAssistantReplyLocally({
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        threadId: String(thread._id),
        text,
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ threadId: String(thread._id), message: { ...userMsg.toObject(), _id: String(userMsg._id) } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('POST /api/chat/messages failed', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (origin) {
      try {
        const hdrs = req.headers;
        const expectedHost =
          hdrs.get('x-forwarded-host') ||
          hdrs.get('host') ||
          new URL(req.url).host;
        const originHost = new URL(origin).host;
        if (originHost !== expectedHost) return new Response('Forbidden', { status: 403 });
      } catch {}
    }
    await connectToDatabase();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    if (!threadId) return new Response('threadId required', { status: 400 });

    const thread = await ChatThreadModel.findOne({ _id: threadId, userId: session.user.id });
    if (!thread) return new Response('thread not found', { status: 404 });

    await ChatMessageModel.deleteMany({ threadId: thread._id, userId: session.user.id });
    await ChatThreadModel.deleteOne({ _id: thread._id, userId: session.user.id });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('DELETE /api/chat/messages failed', e);
    return new Response('Internal Server Error', { status: 500 });
  }
}
