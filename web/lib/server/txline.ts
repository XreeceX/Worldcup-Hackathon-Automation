/**
 * Server-only TxLINE client for Next.js API routes (Vercel BFF).
 * Credentials: TXLINE_JWT (optional — auto guest) + TXLINE_API_TOKEN (required for data).
 */

const API_BASE = 'https://txline-dev.txodds.com/api';
const JWT_URL = 'https://txline-dev.txodds.com/auth/guest/start';

type Auth = { jwt: string; apiToken: string };

let cached: Auth | null = null;

async function guestJwt(): Promise<string> {
  const res = await fetch(JWT_URL, { method: 'POST', cache: 'no-store' });
  if (!res.ok) throw new Error(`TxLINE guest auth failed: ${res.status}`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('TxLINE guest auth returned no token');
  return data.token;
}

async function getAuth(): Promise<Auth> {
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      'TXLINE_API_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.',
    );
  }
  if (cached?.apiToken === apiToken && cached.jwt) return cached;
  const jwt = process.env.TXLINE_JWT || (await guestJwt());
  cached = { jwt, apiToken };
  return cached;
}

async function txlineFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = await getAuth();
  const doFetch = (jwt: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': auth.apiToken,
      },
    });

  let res = await doFetch(auth.jwt);
  if (res.status === 401) {
    const jwt = await guestJwt();
    cached = { jwt, apiToken: auth.apiToken };
    res = await doFetch(jwt);
  }
  return res;
}

export async function getScoresSnapshot(fixtureId: number): Promise<unknown> {
  const res = await txlineFetch(`/scores/snapshot/${fixtureId}`);
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`scores/snapshot ${res.status}`);
  return res.json();
}

export async function getScoresHistorical(fixtureId: number): Promise<unknown> {
  const res = await txlineFetch(`/scores/historical/${fixtureId}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`scores/historical ${res.status}`);
  return res.json();
}

export async function getFixturesSnapshot(
  competitionId = 72,
  startEpochDay = 20624,
): Promise<unknown> {
  const res = await txlineFetch(
    `/fixtures/snapshot?competitionId=${competitionId}&startEpochDay=${startEpochDay}`,
  );
  if (!res.ok) throw new Error(`fixtures/snapshot ${res.status}`);
  return res.json();
}

export async function getOddsSnapshot(
  fixtureId: number,
  asOfMs?: number,
): Promise<unknown> {
  let path = `/odds/snapshot/${fixtureId}`;
  if (asOfMs != null && Number.isFinite(asOfMs)) {
    path += `?asOf=${Math.floor(asOfMs)}`;
  }
  const res = await txlineFetch(path);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`odds/snapshot ${res.status}`);
  return res.json();
}

export function hasTxlineToken(): boolean {
  return Boolean(process.env.TXLINE_API_TOKEN);
}
