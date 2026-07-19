import { getScoresSnapshot } from '@/lib/server/txline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Vercel hobby max; client EventSource reconnects automatically. */
export const maxDuration = 60;

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fixtureId = Number(url.searchParams.get('fixtureId'));
  if (!Number.isFinite(fixtureId)) {
    return new Response(JSON.stringify({ error: 'fixtureId query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      send(': connected\n\n');

      const poll = async () => {
        try {
          const snap = await getScoresSnapshot(fixtureId);
          const rows = Array.isArray(snap)
            ? snap
            : snap && typeof snap === 'object'
              ? [snap]
              : [];
          for (const row of rows) {
            if (row && typeof row === 'object') send(sseEncode(row));
          }
        } catch {
          /* keep heartbeat alive even without TxLINE */
        }
      };

      await poll();
      const pollTimer = setInterval(poll, 8_000);
      const beatTimer = setInterval(() => send(': heartbeat\n\n'), 15_000);

      const stop = () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(beatTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener('abort', stop);
      // End before Vercel kills the function so EventSource reconnects cleanly.
      setTimeout(stop, 55_000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
