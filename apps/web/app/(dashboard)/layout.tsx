import { AuthGuard } from '@/components/AuthGuard';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { TopIconNav } from '@/components/TopIconNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ImpersonationBanner />
      <div className="dashboard-bg">
        <TopIconNav />
        <main className="px-4 pb-10 max-w-3xl mx-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
