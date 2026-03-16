'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './user-menu';

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/projects/new') return 'New Project';
  if (pathname === '/settings') return 'Settings';
  if (pathname === '/patterns') return 'Pattern Library';
  if (pathname.includes('/builder')) return 'Component Builder';
  if (pathname.includes('/analysis')) return 'Analysis Pipeline';
  if (pathname.includes('/auto-build')) return 'Auto Builder';
  if (pathname.includes('/export')) return 'Export';
  if (pathname.includes('/projects/')) return 'Project';
  return 'Studio';
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-card">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
