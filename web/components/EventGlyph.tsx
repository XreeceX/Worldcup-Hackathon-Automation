'use client';

import type { MatchEventKind } from '@/lib/types';

/** Plastic card with depth — used instead of flat 🟨/🟥 emoji. */
export function CardGlyph({
  color,
  size = 'md',
}: {
  color: 'yellow' | 'red';
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'h-3.5 w-2.5' : 'h-4 w-3';
  const yellow =
    'linear-gradient(155deg, #fff3a0 0%, #ffd400 38%, #e6b800 72%, #b88900 100%)';
  const red =
    'linear-gradient(155deg, #ff8a80 0%, #e53935 38%, #c62828 72%, #7f0000 100%)';
  return (
    <span
      className={`inline-block ${dims} shrink-0 rounded-[2px]`}
      style={{
        background: color === 'yellow' ? yellow : red,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.2)',
        transform: 'rotate(-12deg) skewY(-2deg)',
      }}
      title={color === 'yellow' ? 'Yellow card' : 'Red card'}
      aria-label={color === 'yellow' ? 'Yellow card' : 'Red card'}
    />
  );
}

/** Match-event icon: real card glyphs for bookings, emoji elsewhere. */
export function EventGlyph({
  kind,
  action,
}: {
  kind: MatchEventKind;
  action?: string | null;
}) {
  if (kind === 'card') {
    const red = action === 'red_card' || action === 'second_yellow';
    return <CardGlyph color={red ? 'red' : 'yellow'} />;
  }
  const map: Record<string, string> = {
    goal: '⚽',
    corner: '🚩',
    shot: '🎯',
    sub: '🔄',
    period: '⏱',
    freekick: '🦵',
    offside: '🚫',
    foul: '⚠️',
    var: '📺',
    hydration: '💧',
    info: '•',
  };
  return (
    <span className="inline-flex w-4 justify-center text-base leading-none" aria-hidden>
      {map[kind] ?? '•'}
    </span>
  );
}
