import Image from 'next/image';
import { Reveal } from '../Reveal';

const CHIPS: { text: string; left: string; top: string; rot: string }[] = [
  { text: 'A calendar nobody checks', left: '10%', top: '6%', rot: '-8deg' },
  { text: 'To-dos in a second app', left: '58%', top: '2%', rot: '6deg' },
  { text: 'Passwords in your notes', left: '4%', top: '44%', rot: '5deg' },
  { text: 'Ideas lost mid-chat', left: '38%', top: '-4%', rot: '-4deg' },
  { text: 'Screenshots you never reopen', left: '62%', top: '52%', rot: '-6deg' },
  { text: 'Alerts in four places', left: '30%', top: '58%', rot: '7deg' },
  { text: 'Files three folders deep', left: '76%', top: '24%', rot: '-10deg' },
];

export function OverloadLife() {
  return (
    <>
      <section className="zs-overload">
        <div
          className="zs-sticky zs-sticky--lilac zs-float"
          style={
            { left: '10%', top: '22%', width: 80, '--zs-rot': '-14deg' } as React.CSSProperties
          }
        />
        <div
          className="zs-sticky zs-sticky--blue zs-float"
          style={
            {
              right: '12%',
              top: '20%',
              width: 80,
              '--zs-rot': '10deg',
              animationDelay: '1s',
            } as React.CSSProperties
          }
        />
        <div
          className="zs-sticky zs-sticky--yellow zs-float"
          style={
            {
              left: '48%',
              bottom: '18%',
              width: 72,
              '--zs-rot': '-18deg',
              animationDelay: '2s',
            } as React.CSSProperties
          }
        />
        <div className="zs-container">
          <Reveal>
            <p>
              Your head is running a hundred open loops. Dropping a few isn&apos;t a willpower
              problem - it&apos;s simply too much for one brain to hold.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="zs-life">
        <div className="zs-stars" style={{ bottom: '55%' }} />
        <div className="zs-container relative">
          <div className="relative mx-auto max-w-[1200px]">
            {CHIPS.map((chip, i) => (
              <Reveal key={chip.text} delay={i * 90}>
                <span
                  className="zs-chip"
                  style={
                    { left: chip.left, top: chip.top, '--zs-rot': chip.rot } as React.CSSProperties
                  }
                >
                  {chip.text}
                </span>
              </Reveal>
            ))}
            <div className="zs-life-word pt-24">Your life</div>
            <Image
              src="/z/cat-sad.webp"
              alt=""
              width={220}
              height={238}
              className="zs-float absolute right-0 top-10 z-[3] hidden w-[16vw] max-w-[220px] md:block"
            />
          </div>
        </div>

        <div
          className="zs-cloud"
          style={{ '--w': '520px', left: '-8%', top: '46%' } as React.CSSProperties}
        />
        <div
          className="zs-cloud"
          style={{ '--w': '620px', left: '30%', top: '52%', '--t': '22s' } as React.CSSProperties}
        />
        <div
          className="zs-cloud"
          style={{ '--w': '460px', right: '-6%', top: '44%', '--t': '16s' } as React.CSSProperties}
        />
        <div
          className="zs-cloud"
          style={{ '--w': '360px', left: '12%', top: '64%', '--o': 0.8 } as React.CSSProperties}
        />
        <div
          className="zs-cloud"
          style={
            {
              '--w': '420px',
              right: '10%',
              top: '70%',
              '--o': 0.75,
              '--t': '20s',
            } as React.CSSProperties
          }
        />
      </section>
    </>
  );
}
