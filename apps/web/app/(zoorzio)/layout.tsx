import { AuthGuard } from '@/components/AuthGuard';
import { ZoorzioTopBar } from '@/components/ZoorzioTopBar';
import { ZoorzioTabBar } from '@/components/ZoorzioTabBar';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';

export default function ZoorzioLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ImpersonationBanner />
      <div className="zoorzio-bg">
        <ZoorzioTopBar />
        <main className="pb-32">{children}</main>
        <ZoorzioTabBar />
      </div>
    </AuthGuard>
  );
}
