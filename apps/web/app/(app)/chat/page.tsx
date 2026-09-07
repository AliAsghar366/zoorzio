'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Card, Input } from '@anchor/ui';
import { api } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi, I'm Zoorzio. Ask me about anything you've captured, or what's coming up." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4">
        <Image
          src="/zoorzio-icon.png"
          alt="Zoorzio mascot"
          width={40}
          height={40}
          className="rounded-full object-cover"
        />
        <h1 className="text-2xl font-bold text-anchor-800">Chat with Zoorzio</h1>
      </div>

      <Card className="flex-1 overflow-y-auto scrollbar-thin mb-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Image
                  src="/zoorzio-icon.png"
                  alt="Zoorzio"
                  width={28}
                  height={28}
                  className="rounded-full object-cover shrink-0"
                />
              )}
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[75%] rounded-2xl rounded-br-sm bg-primary-400 text-white px-4 py-2 text-sm'
                    : 'max-w-[75%] rounded-2xl rounded-bl-sm bg-anchor-100 text-anchor-800 px-4 py-2 text-sm whitespace-pre-line'
                }
              >
                {message.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-end gap-2 justify-start">
              <Image
                src="/zoorzio-icon.png"
                alt="Zoorzio"
                width={28}
                height={28}
                className="rounded-full object-cover shrink-0"
              />
              <div className="rounded-2xl rounded-bl-sm bg-anchor-100 text-anchor-400 px-4 py-2 text-sm">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </Card>

      <form onSubmit={send} className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Ask Zoorzio anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <Button type="submit" loading={sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
