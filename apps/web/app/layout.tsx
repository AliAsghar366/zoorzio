import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { CookieBanner } from '@/components/CookieBanner';
import './globals.css';

const poppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });

const DESCRIPTION =
  'Zoorzio keeps your reminders, lists, calendar and details in one place, and hands them back right where you already chat: WhatsApp, Telegram or the web.';

export const metadata: Metadata = {
  title: 'Zoorzio | Nothing slips through the cracks',
  description: DESCRIPTION,
  keywords: ['memory', 'productivity', 'AI', 'notes', 'tasks', 'calendar', 'whatsapp', 'telegram'],
  authors: [{ name: 'Zoorzio Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://zoorzio.ai',
    title: 'Zoorzio | Nothing slips through the cracks',
    description: DESCRIPTION,
    siteName: 'Zoorzio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zoorzio | Nothing slips through the cracks',
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-anchor-50 text-anchor-800 antialiased`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
