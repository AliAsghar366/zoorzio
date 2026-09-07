'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, Plus, Send, X } from 'lucide-react';
import { api } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function CoffeeChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Good day! I'm Zoorzio. Take a moment, slow down, and talk through your day." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (content: string) => {
    if (!content.trim() || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const { reply } = await api.post<{ reply: string }>('/chat', { messages: nextMessages });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't respond just now. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('q');
    if (initial && !initialSentRef.current) {
      initialSentRef.current = true;
      send(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="grid md:grid-cols-2 gap-8 px-6 md:px-10 pt-4 md:pt-16 max-w-6xl mx-auto text-white">
      <button
        onClick={() => router.push('/portal')}
        className="glass-btn absolute left-4 top-4 md:hidden"
        aria-label="Back"
      >
        <X size={18} />
      </button>

      <div className="hidden md:flex flex-col justify-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-white/70">Take five</p>
        <h1 className="text-4xl font-bold mt-2">Coffee with Zoorzio</h1>
        <p className="mt-3 text-white/80 max-w-xs">Take a moment, slow down, and talk through your day.</p>
        <div className="mt-10 w-[180px] h-[180px] mascot-float">
          <Image src="/zoorzio-icon.png" alt="Zoorzio mascot" width={180} height={180} className="object-contain" />
        </div>
      </div>

      <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[70vh]">
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-white/90 text-primary-700 px-4 py-2.5 text-sm font-medium shadow-md'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-white/15 border border-white/30 text-white px-4 py-2.5 text-sm whitespace-pre-line'
                }
              >
                {message.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white/15 border border-white/30 text-white/70 px-4 py-2.5 text-sm">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="glass-pill-input mt-4"
        >
          <button type="button" className="w-[42px] h-[42px] rounded-full border border-white/55 bg-white/18 flex items-center justify-center shrink-0" aria-label="Add">
            <Plus size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to Zoorzio…"
            aria-label="Message"
          />
          <button
            type="button"
            className="w-[42px] h-[42px] rounded-full border border-white/55 bg-white/18 flex items-center justify-center shrink-0"
            aria-label="Voice"
          >
            <Mic size={18} />
          </button>
          <button
            type="submit"
            disabled={sending}
            className="w-[42px] h-[42px] rounded-full bg-white/90 text-primary-600 flex items-center justify-center shrink-0 hover:bg-white transition-colors disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CoffeePage() {
  return (
    <Suspense fallback={null}>
      <CoffeeChat />
    </Suspense>
  );
}
