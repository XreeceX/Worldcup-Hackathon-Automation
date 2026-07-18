// Internal event bus: fan-in from txline/replay/keeper, fan-out to SSE clients (spec 02 §2).
import { EventEmitter } from "node:events";

export function createEventBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(100); // many concurrent SSE clients each attach listeners
  return bus;
}
