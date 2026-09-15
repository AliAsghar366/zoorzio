import Image from 'next/image';
import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { Reveal } from '../Reveal';

// Each point here is backed by the API code - see apps/api/src/security and channels.
const POINTS = [
  'Your messages and memories are only used to run your own account.',
  'Sign-in tokens for Google, GitHub, Notion and your channels are encrypted with AES-256-GCM.',
  'Passwords are hashed with Argon2 - never stored in plain text.',
  'Incoming WhatsApp and Telegram messages must pass a signature check before we process them.',
  'We don’t sell your personal data or use advertising cookies.',
];

export function Privacy() {
  return (
    <section className="zs-privacy">
      <div className="zs-container">
        <Reveal>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#c792d0]">
            <Lock size={26} />
          </span>
          <h2 className="zs-h2 mx-auto mt-8 max-w-[760px]">
            Your privacy isn&apos;t something we trade.
          </h2>
          <p className="mx-auto mt-8 max-w-[700px] text-[clamp(20px,2.2vw,30px)] leading-snug">
            Zoorzio only reads what it needs to run your account, and nothing you save is ever sold.
          </p>
        </Reveal>

        <Reveal className="mt-16">
          <div className="zs-vault">
            <div className="zs-vault-text">
              <strong>Here&apos;s what that means in practice.</strong>
              <ul>
                {POINTS.map((point) => (
                  <li key={point}>
                    <Check size={18} className="mt-1 shrink-0 text-[#9fe3b8]" />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href="/security"
                className="mt-4 inline-block font-semibold underline underline-offset-4"
              >
                How we handle security →
              </Link>
            </div>

            <div className="relative mt-8 flex flex-col items-center">
              <div className="zs-speech self-end">I keep the details. You get your head back.</div>
              <Image
                src="/z/cat-security.webp"
                alt="Zoorzio the cat wearing a guard’s cap"
                width={884}
                height={900}
                className="-mb-6 mt-2 w-[min(320px,70%)]"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
