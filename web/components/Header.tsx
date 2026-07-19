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
    <header className="sticky top-0 z-40 border-b border-edge/80 bg-bg/75 backdrop-blur-xl">
      <div className="app-pad flex h-[3.75rem] items-center gap-5 sm:h-16">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-pitch-500 shadow-glow transition-transform duration-300 group-hover:scale-105"
          >
            <span className="absolute inset-x-0 top-1/2 h-px bg-pitch-950/25" />
            <span className="absolute inset-y-0 left-1/2 w-px bg-pitch-950/25" />
            <span className="font-display text-lg font-extrabold leading-none text-pitch-950">
              P
            </span>
          </span>
          <span className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Pledge<span className="text-pitch-400">Pitch</span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3 ${
                  active
                    ? 'bg-raised text-pitch-400'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ClaimsBadge />
          <ConnectMenu />
        </div>
      </div>
    </header>
  );
}
