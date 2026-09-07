import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { CookieBanner } from '@/components/CookieBanner';
import './globals.css';

const poppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Zoorzio — Never Forget Again',
  description:
    'Reliable capture. Real memory retention. Fair pricing. One layer above every app you use.',
  keywords: [
    'memory',
    'productivity',
    'AI',
    'notes',
    'tasks',
    'calendar',
    'whatsapp',
    'telegram',
  ],
  authors: [{ name: 'Zoorzio Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://zoorzio.ai',
    title: 'Zoorzio — Never Forget Again',
    description:
      'Reliable capture. Real memory retention. Fair pricing. One layer above every app you use.',
    siteName: 'Zoorzio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zoorzio — Never Forget Again',
    description:
      'Reliable capture. Real memory retention. Fair pricing. One layer above every app you use.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-anchor-50 text-anchor-800 antialiased`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
