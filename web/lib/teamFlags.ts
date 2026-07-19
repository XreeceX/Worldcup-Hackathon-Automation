/**
 * National-team name → ISO 3166-1 / flagcdn region code.
 * Flags rendered as images from flagcdn.com (not emoji).
 */
const TEAM_CODES: Record<string, string> = {
  algeria: 'dz',
  argentina: 'ar',
  australia: 'au',
  austria: 'at',
  belgium: 'be',
  brazil: 'br',
  cameroon: 'cm',
  canada: 'ca',
  chile: 'cl',
  china: 'cn',
  colombia: 'co',
  'costa rica': 'cr',
  croatia: 'hr',
  czechia: 'cz',
  'czech republic': 'cz',
  denmark: 'dk',
  ecuador: 'ec',
  egypt: 'eg',
  england: 'gb-eng',
  france: 'fr',
  germany: 'de',
  ghana: 'gh',
  greece: 'gr',
  hungary: 'hu',
  iran: 'ir',
  iraq: 'iq',
  italy: 'it',
  "ivory coast": 'ci',
  "cote d'ivoire": 'ci',
  'cote divoire': 'ci',
  jamaica: 'jm',
  japan: 'jp',
  mexico: 'mx',
  morocco: 'ma',
  netherlands: 'nl',
  holland: 'nl',
  nigeria: 'ng',
  'north korea': 'kp',
  'northern ireland': 'gb-nir',
  'south korea': 'kr',
  korea: 'kr',
  norway: 'no',
  panama: 'pa',
  paraguay: 'py',
  peru: 'pe',
  poland: 'pl',
  portugal: 'pt',
  qatar: 'qa',
  'republic of ireland': 'ie',
  ireland: 'ie',
  romania: 'ro',
  russia: 'ru',
  'saudi arabia': 'sa',
  scotland: 'gb-sct',
  senegal: 'sn',
  serbia: 'rs',
  slovakia: 'sk',
  slovenia: 'si',
  'south africa': 'za',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  tunisia: 'tn',
  turkey: 'tr',
  'united states': 'us',
  usa: 'us',
  uruguay: 'uy',
  wales: 'gb-wls',
  ukraine: 'ua',
};

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ');
}

/** ISO / flagcdn code for a team name, or null if unknown. */
export function teamCountryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalize(name);
  if (TEAM_CODES[key]) return TEAM_CODES[key];
  for (const [team, code] of Object.entries(TEAM_CODES)) {
    if (key.includes(team) || team.includes(key)) return code;
  }
  return null;
}

/** PNG flag URL (flagcdn). `w` is width hint: 20 | 40 | 80. */
export function teamFlagUrl(
  name: string | null | undefined,
  w: 20 | 40 | 80 = 40,
): string | null {
  const code = teamCountryCode(name);
  if (!code) return null;
  return `https://flagcdn.com/w${w}/${code}.png`;
}

/** @deprecated emoji fallback — prefer CountryFlag component */
export function teamFlag(name: string | null | undefined): string {
  const code = teamCountryCode(name);
  if (!code) return '🏳️';
  // Keep a tiny emoji fallback for plain-text contexts (feed labels).
  const emojiMap: Record<string, string> = {
    ar: '🇦🇷',
    es: '🇪🇸',
    br: '🇧🇷',
    fr: '🇫🇷',
    de: '🇩🇪',
    eng: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'gb-sct': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'gb-wls': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    pt: '🇵🇹',
    nl: '🇳🇱',
    us: '🇺🇸',
    mx: '🇲🇽',
    jp: '🇯🇵',
    kr: '🇰🇷',
    au: '🇦🇺',
    ca: '🇨🇦',
    ma: '🇲🇦',
    sn: '🇸🇳',
    uy: '🇺🇾',
    hr: '🇭🇷',
    be: '🇧🇪',
    ch: '🇨🇭',
    pl: '🇵🇱',
    dk: '🇩🇰',
    rs: '🇷🇸',
  };
  return emojiMap[code] ?? '🏳️';
}
