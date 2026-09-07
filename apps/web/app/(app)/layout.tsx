import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ImpersonationBanner />
      <div className="min-h-screen bg-anchor-50">
        <Sidebar />
        <MobileNav />
        <main className="md:pl-64">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
