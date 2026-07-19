/**
 * Map Anchor / wallet errors to plain fan-facing copy.
 */
export function programErrorMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : String(err ?? '');

  const map: [RegExp, string][] = [
    [/User rejected|rejected the request|cancell?ed/i, 'Transaction cancelled.'],
    [/Network mismatch|mainnet/i, 'Switch your wallet to Solana Devnet and try again.'],
    [/KickoffPassed/, 'Kickoff has passed — withdrawals are locked.'],
    [/MatchWindowClosed/, 'The match window is closed — new pledges are no longer accepted.'],
    [/DepositTooSmall/, 'Minimum deposit is 0.01 SOL.'],
    [/MemberLimitReached/, 'This pledge has reached its 500-member limit.'],
    [/AlreadyMember/, 'This wallet is already a member (or previously withdrew).'],
    [/AlreadyClaimed/, 'Refund already claimed.'],
    [/NotRefundable/, 'Nothing to claim on this commitment.'],
    [/NotOpen/, 'This commitment has already been settled.'],
    [/WrongBeneficiary/, 'Beneficiary mismatch — cannot settle this commitment.'],
    [/SelfBeneficiary/, 'Beneficiary cannot be your own wallet.'],
    [/ConditionTemplateInvalid/, 'That condition type is not supported on-chain.'],
    [/ConstraintSeeds|seeds constraint/i, 'Account mismatch — refresh and try again (program may need redeploy).'],
    [/insufficient|0 SOL|no record of a prior credit/i, 'Not enough Devnet SOL. Top up at faucet.solana.com.'],
  ];

  for (const [re, msg] of map) {
    if (re.test(raw)) return msg;
  }

  const anchorMsg = raw.match(/Error Message: (.+?)\.?$/m)?.[1];
  if (anchorMsg) return anchorMsg;
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw || 'Unknown error';
}
