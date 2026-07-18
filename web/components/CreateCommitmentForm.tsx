'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEscrow } from '@/hooks/useEscrow';
import {
  conditionLabel,
  SHOOTOUT_DISCLOSURE,
  TEMPLATE_BTTS,
  TEMPLATE_TEAM_WINS,
} from '@/lib/conditions';
import { MIN_DEPOSIT_SOL } from '@/lib/config';
import { solToLamports, truncateAddress, utf8ByteLength } from '@/lib/format';
import type { Fixture } from '@/lib/types';
import { toastTxError, toastTxSuccess } from './toast';

const ConnectMenu = dynamic(
  () => import('./ConnectMenu').then((m) => m.ConnectMenu),
  { ssr: false },
);

type Step = 1 | 2 | 3;

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === step ? 'w-8 bg-pitch-500' : n < step ? 'w-4 bg-pitch-700' : 'w-4 bg-edge'
          }`}
        />
      ))}
    </div>
  );
}

export function CreateCommitmentForm({ fixture }: { fixture: Fixture }) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const escrow = useEscrow();
  // publicKey is the reliable signal — `connected` alone can lag after select().
  const ready = Boolean(connected && publicKey && escrow);

  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<number | null>(null);
  const [param, setParam] = useState<number>(0);
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const kickoffPassed = Date.now() >= fixture.kickoffTs;

  const label = useMemo(
    () =>
      template == null
        ? ''
        : conditionLabel(template, param, fixture.homeTeam, fixture.awayTeam),
    [template, param, fixture],
  );

  const defaultName = useMemo(() => {
    if (template === TEMPLATE_TEAM_WINS) {
      return `${param === 0 ? fixture.homeTeam : fixture.awayTeam} DAO`;
    }
    return `${label || 'Match'} pledge`;
  }, [template, param, fixture, label]);

  // --- validation ---
  const beneficiaryValid = useMemo(() => {
    try {
      return beneficiary.length > 0 && Boolean(new PublicKey(beneficiary));
    } catch {
      return false;
    }
  }, [beneficiary]);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= MIN_DEPOSIT_SOL;
  const nameBytes = utf8ByteLength(name || defaultName);
  const nameValid = nameBytes <= 64;
  const step2Valid = beneficiaryValid && amountValid && nameValid;

  async function signAndLock() {
    if (!ready || !escrow) return;
    if (template == null || !step2Valid) return;
    setSubmitting(true);
    try {
      const { txSig, commitment } = await escrow.createCommitment({
        fixtureId: fixture.fixtureId,
        kickoffTs: Math.floor(fixture.kickoffTs / 1000),
        conditionTemplate: template,
        conditionParam: template === TEMPLATE_TEAM_WINS ? param : 0,
        beneficiary,
        depositLamports: solToLamports(amountNum),
        name: name || defaultName,
      });
      toastTxSuccess('Pledge locked on-chain.', txSig);
      router.push(`/commitment/${commitment}`);
    } catch (err) {
      toastTxError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (kickoffPassed) {
    return (
      <div className="card p-6 text-sm text-muted">
        This match has kicked off — new commitments are locked. Pick an upcoming
        fixture from the board to create a pledge.
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight">Create a commitment</h2>
        <StepDots step={step} />
      </div>

      {step === 1 && (
        <div>
          <p className="label">Step 1 — Select condition</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                setTemplate(TEMPLATE_BTTS);
              }}
              className={`rounded-2xl border p-5 text-left transition-colors ${
                template === TEMPLATE_BTTS
                  ? 'border-pitch-500 bg-pitch-500/10'
                  : 'border-edge bg-raised hover:border-pitch-700'
              }`}
            >
              <p className="text-base font-bold">Both teams score</p>
              <p className="mt-1 text-xs text-muted">
                {fixture.homeTeam} and {fixture.awayTeam} each score at least one
                goal.
              </p>
            </button>
            <button
              onClick={() => setTemplate(TEMPLATE_TEAM_WINS)}
              className={`rounded-2xl border p-5 text-left transition-colors ${
                template === TEMPLATE_TEAM_WINS
                  ? 'border-pitch-500 bg-pitch-500/10'
                  : 'border-edge bg-raised hover:border-pitch-700'
              }`}
            >
              <p className="text-base font-bold">Team wins</p>
              <p className="mt-1 text-xs text-muted">
                Your chosen side wins on goals at full time.
              </p>
            </button>
          </div>

          {template === TEMPLATE_TEAM_WINS && (
            <div className="mt-4 rounded-2xl border border-edge bg-raised p-4">
              <p className="label">Which team?</p>
              <div className="flex flex-wrap gap-2">
                {[fixture.homeTeam, fixture.awayTeam].map((team, i) => (
                  <label
                    key={team}
                    className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      param === i
                        ? 'border-pitch-500 bg-pitch-500/15 text-pitch-400'
                        : 'border-edge text-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="team"
                      className="sr-only"
                      checked={param === i}
                      onChange={() => setParam(i)}
                    />
                    {team} wins
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs italic text-amber-400/90">
                {SHOOTOUT_DISCLOSURE}
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              className="btn-primary"
              disabled={template == null}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <label className="label" htmlFor="beneficiary">
              Step 2 — Beneficiary address
            </label>
            <input
              id="beneficiary"
              className="input font-mono"
              placeholder="Paste a Solana address (devnet)"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value.trim())}
              autoComplete="off"
              spellCheck={false}
            />
            {beneficiary && !beneficiaryValid && (
              <p className="mt-1.5 text-xs text-red-400">Not a valid Solana address.</p>
            )}
            <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              ⚠ This address is unverified and cannot be changed after you sign.
              Funds sent here are permanent.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="amount">
              Amount (SOL)
            </label>
            <input
              id="amount"
              className="input font-mono"
              type="number"
              min={MIN_DEPOSIT_SOL}
              step="0.01"
              placeholder="0.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amount && !amountValid && (
              <p className="mt-1.5 text-xs text-red-400">Minimum deposit is 0.01 SOL.</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="name">
              Commitment name <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <input
              id="name"
              className="input"
              placeholder={defaultName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
            <p className={`mt-1.5 text-xs ${nameValid ? 'text-muted' : 'text-red-400'}`}>
              {nameBytes}/64 bytes{!nameValid && ' — too long'}
            </p>
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn-primary" disabled={!step2Valid} onClick={() => setStep(3)}>
              Review
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="label">Step 3 — Review and sign</p>
          <dl className="divide-y divide-edge rounded-2xl border border-edge bg-raised">
            {[
              ['Fixture', `${fixture.homeTeam} vs ${fixture.awayTeam}`],
              ['Condition', label],
              ['Beneficiary', beneficiary],
              ['Amount', `${amountNum} SOL`],
              ['Name', name || defaultName],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-muted">{k}</dt>
                <dd
                  className={`text-right text-sm font-semibold ${
                    k === 'Beneficiary' ? 'break-all font-mono text-xs' : ''
                  }`}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Funds lock in a program-owned vault until the result is proven
            on-chain. If the condition fails, your full deposit is reclaimable —
            beneficiary {truncateAddress(beneficiary)} is only paid if it holds.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button className="btn-secondary" onClick={() => setStep(2)} disabled={submitting}>
              Back
            </button>
            {ready ? (
              <button className="btn-primary" onClick={signAndLock} disabled={submitting}>
                {submitting ? 'Confirming…' : 'Sign and lock'}
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <ConnectMenu />
                <p className="text-[11px] text-muted">
                  Connect Phantom or Solflare (Devnet) to sign this pledge.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
