// Path A: Anchor program client (spec 02 §1) — stubbed behind the same interface.
//
// Not implemented this session: commitment-engine/target/idl is empty (anchor build has not
// produced an IDL yet), so there is nothing to bind a Program client to. Per 05 F1/F3, Path A
// is gated on that build succeeding; until it does, ESCROW_MODE=anchor fails loudly instead of
// silently behaving like custody mode.
import { assertEscrowClient } from "./interface.mjs";

const UNAVAILABLE =
  "ESCROW_MODE=anchor: commitment-engine/target/idl has no built IDL yet — Path A is unavailable this session (05 F1 gate). Use ESCROW_MODE=keeper (custody).";

export function createAnchorEscrow() {
  const notImplemented = async () => {
    throw new Error(UNAVAILABLE);
  };
  return assertEscrowClient({
    mode: "anchor",
    prepareCreate: notImplemented,
    confirmCreate: notImplemented,
    release: notImplemented,
    getBalanceLamports: notImplemented,
  });
}
