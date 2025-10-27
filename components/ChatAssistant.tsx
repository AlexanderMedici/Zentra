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
  const [sseActive, setSseActive] = useState(false);
  const pollInFlightRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);
  const sseDeliveredRef = useRef(false);
  const sseTimeoutRef = useRef<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const stopStreamingAndPolling = () => {
    try { sseRef.current?.close(); } catch {}
    sseRef.current = null;
    setSseActive(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (pollAbortRef.current) {
      try { pollAbortRef.current.abort(); } catch {}
      pollAbortRef.current = null;
    }
    if (sseTimeoutRef.current) {
      window.clearTimeout(sseTimeoutRef.current);
      sseTimeoutRef.current = null;
    }
  };

  // Poll messages periodically, unless an SSE listener is active
  useEffect(() => {
    if (!threadId || sseActive || !open) return;

    const tick = async () => {
      if (pollInFlightRef.current) return; // prevent overlapping polls
      pollInFlightRef.current = true;
      const controller = new AbortController();
      pollAbortRef.current = controller;
      try {
        const res = await fetch(`/api/chat/messages?threadId=${threadId}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const msgs: Message[] = data.messages || [];
          setMessages(msgs);
        }
      } catch {
        // swallow errors on poll
      } finally {
        pollInFlightRef.current = false;
      }
    };

    // initial load
    tick();
    // use a slightly longer interval to reduce load
    intervalRef.current = window.setInterval(tick, 8000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (pollAbortRef.current) {
        try { pollAbortRef.current.abort(); } catch {}
        pollAbortRef.current = null;
      }
      pollInFlightRef.current = false;
    };
  }, [threadId, sseActive, open]);

  const fetchMessagesOnce = async (tid?: string | null) => {
    const id = tid ?? threadId;
    if (!id) return;
    if (pollInFlightRef.current) return;
    const controller = new AbortController();
    pollAbortRef.current = controller;
    pollInFlightRef.current = true;
    try {
      const res = await fetch(`/api/chat/messages?threadId=${id}`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        const msgs: Message[] = data.messages || [];
        setMessages(msgs);
      }
    } catch {}
    finally {
      pollInFlightRef.current = false;
    }
  };

  const openSSE = (tid: string) => {
    try {
      sseRef.current?.close();
      const es = new EventSource(`/api/chat/stream?threadId=${tid}`);
      sseRef.current = es;
      setSseActive(true);
      sseDeliveredRef.current = false;
      // guard timeout: stop typing indicator if nothing arrives in 25s
      if (sseTimeoutRef.current) window.clearTimeout(sseTimeoutRef.current);
      sseTimeoutRef.current = window.setTimeout(() => {
        if (!sseDeliveredRef.current) {
          setAwaitingReply(false);
          setSseActive(false);
          es.close();
          sseRef.current = null;
          fetchMessagesOnce(tid);
        }
      }, 25000);
      // stop polling while SSE is active
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      es.addEventListener('message', (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data);
          if (data && data.role === 'assistant') {
            setMessages((prev) => [...prev, { _id: data._id, role: 'assistant', content: data.content }]);
            setAwaitingReply(false);
            setExpectedAssistantCount(null);
            sseDeliveredRef.current = true;
            if (sseTimeoutRef.current) {
              window.clearTimeout(sseTimeoutRef.current);
              sseTimeoutRef.current = null;
            }
            es.close();
            sseRef.current = null;
            setSseActive(false);
          }
        } catch {}
      });
      es.addEventListener('error', () => {
        es.close();
        sseRef.current = null;
        setSseActive(false);
        if (!sseDeliveredRef.current) {
          setAwaitingReply(false);
          fetchMessagesOnce(tid);
        }
        if (sseTimeoutRef.current) {
          window.clearTimeout(sseTimeoutRef.current);
          sseTimeoutRef.current = null;
        }
      });
    } catch {}
  };

  const clearConversation = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      // stop SSE + polling before clearing
      stopStreamingAndPolling();

      if (threadId) {
        await fetch(`/api/chat/messages?threadId=${threadId}`, { method: 'DELETE' });
      }

      // reset UI state
      setMessages([]);
      setThreadId(null);
      setAwaitingReply(false);
      setExpectedAssistantCount(null);
      setInput('');
    } finally {
      setClearing(false);
    }
  };

  const newChat = () => {
    // Start a fresh thread without deleting old messages
    stopStreamingAndPolling();
    setMessages([]);
    setThreadId(null);
    setAwaitingReply(false);
    setExpectedAssistantCount(null);
    setInput('');
  };

  const send = async () => {
    if (!input.trim() || sending || awaitingReply) return;
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
        <div className="flex items-center gap-2">
          <button
            aria-label="Start new chat"
            onClick={newChat}
            disabled={sending || awaitingReply}
            className="text-xs px-2 py-1 rounded bg-[#131a22] text-gray-300 hover:text-white disabled:opacity-50"
            title="Start new chat"
          >
            New
          </button>
          <button
            aria-label="Clear conversation"
            onClick={clearConversation}
            disabled={clearing || sending || awaitingReply}
            className="text-xs px-2 py-1 rounded bg-[#131a22] text-gray-300 hover:text-white disabled:opacity-50"
            title="Clear conversation"
          >
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
          <button aria-label="Close chat" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
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
        <Button className="yellow-btn" disabled={sending || awaitingReply || !input.trim()} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
