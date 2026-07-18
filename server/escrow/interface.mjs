// The dual-path escrow contract (spec 02 §1/§2). Every implementation (custody, anchor,
// or a test fake) must expose exactly these four async methods.
//
//   prepareCreate({ pledger, amountLamports })     -> { instructions: TransactionInstruction[], destination: string }
//   confirmCreate(signature)                       -> { lamports: bigint }   // verified deposit, throws if invalid
//   release(pledge, outcome: "success"|"failure")  -> { signature: string }  // beneficiary on success, pledger on failure
//   getBalanceLamports()                           -> bigint                // live escrow balance, for the invariant readout

export const ESCROW_METHODS = ["prepareCreate", "confirmCreate", "release", "getBalanceLamports"];

export function assertEscrowClient(client) {
  for (const method of ESCROW_METHODS) {
    if (typeof client[method] !== "function") {
      throw new Error(`escrow client missing required method: ${method}`);
    }
  }
  return client;
}
