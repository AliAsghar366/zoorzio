import { CheckCircle2 } from 'lucide-react';
import { PhoneChat } from '../ChatThread';
import { Reveal } from '../Reveal';

const PILLS = [
  'Nothing new to install',
  'No commands to learn',
  'Works where you already chat',
  'No folders to maintain',
];

const CHAT = [
  { from: 'me' as const, text: 'Remind me tomorrow at 9pm to call the accountant' },
  {
    from: 'bot' as const,
    text: 'Set ✅ Tomorrow at 9:00 PM I’ll remind you to call the accountant.',
  },
  { from: 'me' as const, text: 'What’s on my calendar Friday?' },
  { from: 'bot' as const, text: 'Friday 📅\n10:00 Dentist\n13:00 Lunch with Sam' },
];

export function NoHarder() {
  return (
    <section className="zs-sky py-28">
      <div
        className="zs-cloud"
        style={{ '--w': '380px', right: '-80px', top: '8%', '--o': 0.85 } as React.CSSProperties}
      />
      <div className="zs-container grid items-center gap-16 md:grid-cols-2">
        <Reveal>
          <span className="zs-tag">Easy</span>
          <h2 className="zs-h2 mt-6">As easy as texting someone you know.</h2>
          <p className="mt-6 max-w-[520px] text-[clamp(18px,1.5vw,21px)] leading-relaxed text-white/95">
            Think of Zoorzio as the contact in your phone that actually gets things done. Type it or
            say it in a voice note, and it&apos;s handled.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4">
            {PILLS.map((pill) => (
              <span key={pill} className="zs-pill-check">
                <CheckCircle2 size={22} /> {pill}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal className="flex justify-center" delay={150}>
          <PhoneChat messages={CHAT} />
        </Reveal>
      </div>
    </section>
  );
}
