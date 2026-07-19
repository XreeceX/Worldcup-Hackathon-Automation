'use client';

import { useCallback, useState } from 'react';
import { camelise, feedUrl } from '@/lib/api';
import type { FeedEvent } from '@/lib/types';
import { useEventSource } from './useEventSource';

const MAX_EVENTS = 50;

/**
 * Subscribes to the keeper /api/feed SSE stream. Also exposes the set of
 * commitment pubkeys seen in `resolved` events — the ONLY signal that may
 * flip the in-play card to "Resolved" (FR-15.5).
 */
export function useFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [resolvedPubkeys, setResolvedPubkeys] = useState<Set<string>>(new Set());

  const onMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const ev = camelise<Record<string, unknown>>(data);
    const feedEvent: FeedEvent = {
      type: typeof ev.type === 'string' ? ev.type : 'event',
      conditionMet: typeof ev.conditionMet === 'boolean' ? ev.conditionMet : undefined,
      txSig: typeof ev.txSig === 'string' ? ev.txSig : undefined,
      fixtureId: typeof ev.fixtureId === 'number' ? ev.fixtureId : undefined,
      status: typeof ev.status === 'string' ? (ev.status as FeedEvent['status']) : undefined,
      commitment:
        ev.commitment && typeof ev.commitment === 'object'
          ? (ev.commitment as FeedEvent['commitment'])
          : typeof ev.commitment === 'string'
            ? { pubkey: ev.commitment }
            : undefined,
      receivedAt: Date.now(),
    };
    setEvents((prev) => [feedEvent, ...prev].slice(0, MAX_EVENTS));
    const pubkey =
      feedEvent.commitment?.pubkey ??
      (typeof ev.pubkey === 'string' ? ev.pubkey : undefined);
    if (feedEvent.type === 'resolved' && pubkey) {
      setResolvedPubkeys((prev) => new Set(prev).add(pubkey));
    }
  }, []);

  const state = useEventSource(feedUrl(), onMessage);
  return { events, resolvedPubkeys, state };
}
