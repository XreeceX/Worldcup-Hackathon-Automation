// TxLINE devnet API client (design-01.md §6, txline-boilerplate.md).
// Holds auth state, renews the JWT on 401 (X-Api-Token stays stable), and
// exposes the REST endpoints plus the SSE score-stream subscription.

import axios from 'axios';
import { EventSource } from 'eventsource';
import { log } from './logger.mjs';

export const API_BASE_URL = 'https://txline-dev.txodds.com/api';
export const JWT_URL = 'https://txline-dev.txodds.com/auth/guest/start';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createTxlineClient({ jwt, apiToken }) {
  const authState = { jwt, apiToken };
  let renewPromise = null;

  // Single-flight JWT renewal shared by REST interceptor and SSE fetch.
  function renewJwt() {
    if (!renewPromise) {
      renewPromise = (async () => {
        log.info('[txline] JWT expired or rejected — acquiring new guest session');
        const response = await axios.post(JWT_URL);
        authState.jwt = response.data.token;
        return authState.jwt;
      })().finally(() => {
        renewPromise = null;
      });
    }
    return renewPromise;
  }

  const apiClient = axios.create({ baseURL: API_BASE_URL });

  apiClient.interceptors.request.use((config) => {
    if (authState.jwt) config.headers['Authorization'] = `Bearer ${authState.jwt}`;
    if (authState.apiToken) config.headers['X-Api-Token'] = authState.apiToken;
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && original && !original._retry) {
        original._retry = true;
        try {
          const newJwt = await renewJwt();
          original.headers['Authorization'] = `Bearer ${newJwt}`;
          return apiClient(original);
        } catch (renewError) {
          log.error('[txline] JWT renewal failed', renewError.message);
          return Promise.reject(renewError);
        }
      }
      return Promise.reject(error);
    }
  );

  // Initial attempt + up to `retries` retries with 1s / 2s / 4s backoff.
  async function withRetry(label, fn, retries = 3) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= retries) throw e;
        const delay = 1000 * 2 ** attempt;
        log.warn(
          `[txline] ${label} failed (${e.message}) — retry ${attempt + 1}/${retries} in ${delay}ms`
        );
        await sleep(delay);
      }
    }
  }

  async function getFixturesSnapshot(competitionId = 72, startEpochDay = undefined) {
    let url = `/fixtures/snapshot?competitionId=${competitionId}`;
    if (startEpochDay != null) url += `&startEpochDay=${startEpochDay}`;
    return (await apiClient.get(url)).data;
  }

  async function getFixtureUpdates(epochDay, hour) {
    return (await apiClient.get(`/fixtures/updates/${epochDay}/${hour}`)).data;
  }

  async function getFixtureValidation(fixtureId, ts) {
    return withRetry('fixtures/validation', async () => {
      const url = `/fixtures/validation?fixtureId=${fixtureId}&timestamp=${ts}`;
      return (await apiClient.get(url)).data;
    });
  }

  async function getScoresHistorical(fixtureId) {
    return (await apiClient.get(`/scores/historical/${fixtureId}`)).data;
  }

  async function getScoresUpdates(epochDay, hour, interval) {
    return (await apiClient.get(`/scores/updates/${epochDay}/${hour}/${interval}`)).data;
  }

  async function getStatValidation(fixtureId, seq, statKeys) {
    return withRetry('scores/stat-validation', async () => {
      const url = `/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=${statKeys.join(',')}`;
      return (await apiClient.get(url)).data;
    });
  }

  /**
   * SSE subscription (design §7.3). Auth headers injected via custom fetch,
   * Last-Event-ID resume, close + reconnect after 3s on any error.
   * The caller receives every raw score event via onEvent; filtering to
   * game_finalised happens in the keeper (BUG-01 fix lives there).
   */
  function subscribeScores({ onEvent, onOpen, onDisconnect } = {}) {
    let es = null;
    let lastSeenId;
    let stopped = false;
    let reconnectTimer = null;
    const state = { connected: false };

    function connect() {
      if (stopped) return;
      es = new EventSource(`${API_BASE_URL}/scores/stream`, {
        fetch: async (input, init) => {
          const headers = {
            ...(init?.headers ?? {}),
            'Accept-Encoding': 'deflate',
            'Authorization': `Bearer ${authState.jwt}`,
            'X-Api-Token': authState.apiToken,
          };
          if (lastSeenId) headers['Last-Event-ID'] = lastSeenId;

          let response = await fetch(input, { ...init, headers });
          if (response.status === 401 || response.status === 403) {
            const newJwt = await renewJwt();
            headers['Authorization'] = `Bearer ${newJwt}`;
            response = await fetch(input, { ...init, headers });
          }
          return response;
        },
      });

      es.onopen = () => {
        state.connected = true;
        log.info('[txline] SSE score stream connected');
        onOpen?.();
      };

      es.onmessage = (event) => {
        if (event.lastEventId) lastSeenId = event.lastEventId;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          log.warn('[txline] SSE message was not valid JSON — skipped');
          return;
        }
        onEvent?.(data);
      };

      es.onerror = (err) => {
        const wasConnected = state.connected;
        state.connected = false;
        es.close();
        if (wasConnected || !reconnectTimer) {
          log.warn(
            `[txline] SSE disconnected (${err?.message ?? 'stream error'}) — reconnecting in 3s; polling continues independently`
          );
        }
        onDisconnect?.();
        if (!stopped) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 3_000);
        }
      };
    }

    connect();

    return {
      get connected() {
        return state.connected;
      },
      close() {
        stopped = true;
        clearTimeout(reconnectTimer);
        es?.close();
        state.connected = false;
      },
    };
  }

  return {
    authState,
    apiClient,
    renewJwt,
    getFixturesSnapshot,
    getFixtureUpdates,
    getFixtureValidation,
    getScoresHistorical,
    getScoresUpdates,
    getStatValidation,
    subscribeScores,
  };
}
