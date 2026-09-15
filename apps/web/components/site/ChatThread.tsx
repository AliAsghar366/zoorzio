'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export interface ChatMessage {
  from: 'me' | 'bot';
  text: string;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  loop?: boolean;
  className?: string;
}

/** Plays a scripted conversation one bubble at a time, with a typing indicator before replies. */
export function ChatThread({ messages, loop = true, className = '' }: ChatThreadProps) {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (shown < messages.length) {
      const next = messages[shown];
      if (next.from === 'bot' && !typing) {
        timer = setTimeout(() => setTyping(true), 450);
      } else {
        timer = setTimeout(
          () => {
            setTyping(false);
            setShown((count) => count + 1);
          },
          next.from === 'bot' ? 1300 : 800,
        );
      }
    } else if (loop) {
      timer = setTimeout(() => setShown(0), 4500);
    }

    return () => clearTimeout(timer);
  }, [shown, typing, messages, loop]);

  return (
    <div className={`zs-chat ${className}`} aria-live="polite">
      {messages.slice(0, shown).map((message, index) => (
        <div
          key={index}
          className={`zs-bubble ${message.from === 'me' ? 'zs-bubble--me' : 'zs-bubble--bot'}`}
        >
          {message.text}
          <time>9:41</time>
        </div>
      ))}
      {typing && (
        <div className="zs-typing" aria-label="Zoorzio is typing">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}

export function PhoneChat({
  messages,
  className = '',
}: {
  messages: ChatMessage[];
  className?: string;
}) {
  return (
    <div className={`zs-phone ${className}`}>
      <div className="zs-phone-screen zs-chat-wall">
        <div className="zs-phone-island" />
        <div className="zs-phone-top">
          <Image src="/z/cat-flow.webp" alt="" width={34} height={34} />
          <div>
            Zoorzio
            <div className="text-[11px] font-normal text-[#667]">online</div>
          </div>
        </div>
        <div className="zs-phone-body">
          <ChatThread messages={messages} />
        </div>
      </div>
    </div>
  );
}
