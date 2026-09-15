import Image from 'next/image';
import { Settings, Sparkles, Star } from 'lucide-react';
import { Reveal } from '../Reveal';

const CARDS = [
  {
    icon: <Star size={30} fill="#7fd6a6" color="#3fae73" />,
    title: 'Think clearly',
    text: 'without retracing where you saved it',
  },
  {
    icon: <Sparkles size={30} color="#7d8ff0" />,
    title: 'Make things happen',
    text: 'without babysitting an endless list',
  },
  {
    icon: <Settings size={30} color="#ea6fc0" />,
    title: 'Decide with confidence',
    text: 'without juggling every last detail',
  },
];

export function Relief() {
  return (
    <section className="zs-relief">
      <div className="zs-container">
        <Reveal>
          <h2 className="zs-h2 max-w-[1150px] !text-[clamp(44px,8vw,120px)] !leading-[0.98]">
            Hand the remembering to Zoorzio. Keep your head for living.
          </h2>
        </Reveal>

        <div className="mt-20 grid items-end gap-12 md:grid-cols-2">
          <Reveal className="relative order-2 md:order-1">
            <div className="zs-speech mb-4 ml-[18%]">
              I’ll handle the background stuff, so you can focus on what counts.
            </div>
            <Image
              src="/z/cat-basket.webp"
              alt="Zoorzio the cat sitting in a flower basket"
              width={900}
              height={663}
              className="w-full max-w-[560px]"
            />
          </Reveal>

          <div className="order-1 flex flex-col items-end gap-6 md:order-2">
            {CARDS.map((card, i) => (
              <Reveal key={card.title} delay={i * 120} className="w-full md:w-auto">
                <div
                  className="zs-relief-card ml-auto"
                  style={{ marginRight: `${(2 - i) * 40}px` }}
                >
                  <span className="shrink-0">{card.icon}</span>
                  <div>
                    <h4>{card.title}</h4>
                    <p>{card.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
