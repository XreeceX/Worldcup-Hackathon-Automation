/**
 * World Cup 2026 national-team coaches.
 * TxLINE lineup payloads do not include coaching staff — this fills the UI gap
 * for squads in our knockout schedule.
 */
const WC_COACHES: Record<string, string> = {
  algeria: 'Vladimir Petković',
  argentina: 'Lionel Scaloni',
  australia: 'Tony Popovic',
  austria: 'Ralf Rangnick',
  belgium: 'Rudi Garcia',
  'bosnia & herzegovina': 'Sergej Barbarez',
  bosnia: 'Sergej Barbarez',
  brazil: 'Carlo Ancelotti',
  canada: 'Jesse Marsch',
  'cape verde': 'Bubista',
  colombia: 'Néstor Lorenzo',
  'congo dr': 'Sébastien Desabre',
  croatia: 'Zlatko Dalić',
  ecuador: 'Sebastián Beccacece',
  egypt: 'Hossam Hassan',
  england: 'Thomas Tuchel',
  france: 'Didier Deschamps',
  germany: 'Julian Nagelsmann',
  ghana: 'Otto Addo',
  'ivory coast': 'Emerse Faé',
  japan: 'Hajime Moriyasu',
  mexico: 'Javier Aguirre',
  morocco: 'Walid Regragui',
  netherlands: 'Ronald Koeman',
  norway: 'Ståle Solbakken',
  paraguay: 'Gustavo Alfaro',
  portugal: 'Roberto Martínez',
  senegal: 'Pape Thiaw',
  'south africa': 'Hugo Broos',
  spain: 'Luis de la Fuente',
  sweden: 'Jon Dahl Tomasson',
  switzerland: 'Murat Yakin',
  usa: 'Mauricio Pochettino',
  'united states': 'Mauricio Pochettino',
};

function normalizeTeam(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Head coach for a national team, if known. */
export function coachForTeam(team: string | null | undefined): string | null {
  if (!team) return null;
  const key = normalizeTeam(team);
  return WC_COACHES[key] ?? null;
}
