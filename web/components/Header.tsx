'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ClaimsBadge } from './ClaimsBadge';

// ConnectMenu uses wallet hooks — client-only.
const ConnectMenu = dynamic(
  () => import('./ConnectMenu').then((m) => m.ConnectMenu),
  {
    ssr: false,
    loading: () => (
      <div className="h-[42px] w-28 animate-pulse rounded-xl border border-edge bg-raised" />
    ),
  },
);

const NAV = [
  { href: '/', label: 'Board' },
  { href: '/claims', label: 'Claims' },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pitch-500 text-base font-black text-pitch-950 shadow-glow">
            ⚽
          </span>
          <span className="hidden text-lg font-black tracking-tight sm:block">
            Pledge<span className="text-pitch-400">Pitch</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                pathname === item.href
                  ? 'bg-raised text-pitch-400'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ClaimsBadge />
          <ConnectMenu />
        </div>
      </div>
    </header>
  );
}
