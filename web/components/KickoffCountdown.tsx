'use client';

import { useEffect, useState } from 'react';

/**
 * Pre-kickoff countdown. Join stays open through the live window on-chain;
 * withdrawals lock at kickoff — this display marks that moment.
 */
export function KickoffCountdown({ kickoffTsSec }: { kickoffTsSec: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.floor(kickoffTsSec - now / 1000));
  const locked = remaining === 0;
  const fmt = [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
    .map((x) => String(x).padStart(2, '0'))
    .join(':');

  return (
    <section className="card px-5 py-8 text-center sm:px-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
        {locked ? 'Withdrawals' : 'Kickoff in'}
      </p>
      <p
        className={`mt-2 font-mono text-4xl font-black tabular-nums sm:text-5xl ${
          locked ? 'text-muted' : 'text-pitch-400'
        }`}
      >
        {locked ? 'LOCKED' : fmt}
      </p>
      <p className="mx-auto mt-3 max-w-sm text-xs text-muted">
        {locked
          ? 'Kickoff has passed — withdrawals are closed. You can still join while the match is live.'
          : 'Anyone can join. Withdrawals lock at kickoff (enforced on-chain).'}
      </p>
    </section>
  );
}
