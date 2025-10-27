'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';

type Message = { _id: string; role: 'user' | 'assistant' | 'system'; content: string };

type ChatAssistantProps = {
  user?: { id: string; name?: string | null; email?: string | null };
};

export default function ChatAssistant({ user }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [expectedAssistantCount, setExpectedAssistantCount] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Poll messages periodically, unless an SSE listener is active
  useEffect(() => {
    if (!threadId || sseRef.current) return;
    const tick = async () => {
      try {
        const res = await fetch(`/api/chat/messages?threadId=${threadId}`);
        if (res.ok) {
          const data = await res.json();
          const msgs: Message[] = data.messages || [];
          setMessages(msgs);
        }
      } catch {}
    };
    tick();
    intervalRef.current = window.setInterval(tick, 5000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [threadId]);

  const openSSE = (tid: string) => {
    try {
      sseRef.current?.close();
      const es = new EventSource(`/api/chat/stream?threadId=${tid}`);
      sseRef.current = es;
      es.addEventListener('message', (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data);
          if (data && data.role === 'assistant') {
            setMessages((prev) => [...prev, { _id: data._id, role: 'assistant', content: data.content }]);
            setAwaitingReply(false);
            setExpectedAssistantCount(null);
            es.close();
            sseRef.current = null;
          }
        } catch {}
      });
      es.addEventListener('error', () => {
        es.close();
        sseRef.current = null;
      });
    } catch {}
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId, text: input.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setThreadId(data.threadId);
        setInput('');
        // optimistic append of user message
        setMessages((prev) => [...prev, { _id: data.message._id, role: 'user', content: data.message.content }]);
        // Expect one more assistant message to arrive
        const currentAssistantCount = messages.reduce((acc, m) => acc + (m.role === 'assistant' ? 1 : 0), 0);
        setExpectedAssistantCount(currentAssistantCount + 1);
        setAwaitingReply(true);
        openSSE(data.threadId);
      }
    } finally {
      setSending(false);
    }
  };

  // Floating button (closed state)
  if (!open) {
    return (
      <button
        aria-label="Open Finsage Assistant"
        onClick={() => setOpen(true)}
        className="fixed z-[9999] bottom-6 right-6 h-12 w-12 rounded-full bg-yellow-500 text-black shadow-lg hover:bg-yellow-400 transition"
      >
        <MessageCircle className="h-6 w-6 m-auto" />
      </button>
    );
  }

  // Expanded hover panel (open state)
  return (
    <div className="fixed z-[9999] bottom-6 right-6 w-[360px] max-h-[70vh] flex flex-col border rounded-lg bg-[#0B0E11] shadow-xl overflow-hidden transition">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="text-gray-300 font-medium">Finsage Assistant</div>
        <button aria-label="Close chat" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(() => {
          const name = (user?.name || user?.email || 'there') as string;
          const first = name.split(' ')[0];
          return (
            <div className="text-left">
              <div className="inline-block max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-[#131a22] text-gray-200">
                {`Hello ${first}, I’m Finsage. How can I help today?`}
              </div>
            </div>
          );
        })()}
        {messages.map((m) => (
          <div key={m._id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-yellow-500 text-black' : 'bg-[#131a22] text-gray-200'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">Ask about markets, watchlist symbols, or trends.</div>
        )}
        {awaitingReply && (
          <div className="text-left">
            <div className="inline-flex items-center gap-2 bg-[#131a22] text-gray-300 rounded-lg px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              <span className="text-sm">Assistant is typing…</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 flex items-center gap-2 border-t">
        <input
          className="flex-1 rounded-md bg-[#131a22] text-gray-200 px-3 py-2 outline-none"
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button className="yellow-btn" disabled={sending || !input.trim()} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
