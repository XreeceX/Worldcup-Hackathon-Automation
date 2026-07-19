'use client';

import { teamCountryCode, teamFlagUrl } from '@/lib/teamFlags';

/** Real country flag image for a national team name. */
export function CountryFlag({
  team,
  size = 28,
  className = '',
  title,
}: {
  team: string;
  /** CSS pixel width (height scales with flag aspect ~3:2). */
  size?: number;
  className?: string;
  title?: string;
}) {
  const url = teamFlagUrl(team, size >= 48 ? 80 : size >= 28 ? 40 : 20);
  const code = teamCountryCode(team);
  const h = Math.round(size * 0.67);

  if (!url) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-edge text-[10px] font-bold text-muted ${className}`}
        style={{ width: size, height: h }}
        title={title ?? team}
        aria-label={team}
      >
        ?
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={title ?? `${team} flag`}
      width={size}
      height={h}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-black/20 ${className}`}
      style={{ width: size, height: h }}
      data-country={code ?? undefined}
    />
  );
}
