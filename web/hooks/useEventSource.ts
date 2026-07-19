'use client';

import { useEffect, useRef, useState } from 'react';

export type SseState = 'connecting' | 'open' | 'reconnecting';

/**
 * EventSource wrapper. The browser reconnects automatically; we surface the
 * state so the UI can show "Reconnecting…" (design-01 §9.8).
 */
export function useEventSource(
  url: string | null,
  onMessage: (data: unknown, raw: MessageEvent) => void,
) {
  const [state, setState] = useState<SseState>('connecting');
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!url) return;
    let disposed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      es = new EventSource(url);
      es.onopen = () => setState('open');
      es.onmessage = (ev) => {
        try {
          handlerRef.current(JSON.parse(ev.data), ev);
        } catch {
          handlerRef.current(ev.data, ev);
        }
      };
      es.onerror = () => {
        setState('reconnecting');
        // Some proxies kill the stream permanently; recycle the source.
        es?.close();
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [url]);

  return state;
}
