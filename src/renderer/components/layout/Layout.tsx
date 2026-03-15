import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { ConnectionFailedBanner } from '@/components/layout/ConnectionFailedBanner';

export function Layout() {
  const { pathname } = useLocation();
  const isGraphPage = pathname === '/' || pathname === '/graph';

  return (
    <div className="h-full min-h-screen flex flex-col bg-background">
      <TopBar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!isGraphPage && <ConnectionFailedBanner />}
        <Outlet />
      </main>
    </div>
  );
}
