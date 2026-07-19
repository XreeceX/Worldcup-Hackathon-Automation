export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Settlement feed SSE. On Vercel there is no long-lived keeper process, so
 * we keep the connection healthy with heartbeats. Resolutions still happen
 * on-chain; the board refreshes via polling. Client reconnects when we close.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      send(': connected\n\n');
      const beat = setInterval(() => send(': heartbeat\n\n'), 15_000);
      const stop = () => {
        closed = true;
        clearInterval(beat);
        try {
          controller.close();
        } catch {
          /* */
        }
      };
      req.signal.addEventListener('abort', stop);
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
