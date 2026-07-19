'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEscrow } from '@/hooks/useEscrow';
import { fetchOdds } from '@/lib/api';
import {
  buildConditionParam,
  CONDITION_OPTIONS,
  conditionLabel,
  GOALS_DISCLOSURE,
  PENS_DISCLOSURE,
  SHOOTOUT_DISCLOSURE,
  TEMPLATE_TEAM_WINS,
  TEMPLATE_WINS_BY_AT_LEAST,
  TEMPLATE_WINS_ON_PENS,
  type ConditionOption,
} from '@/lib/conditions';
import { explorerAddressUrl, MIN_DEPOSIT_SOL } from '@/lib/config';
import {
  canCreatePledge,
  fixtureBucket,
  isKnockoutWorldCupFixture,
  isMatchEnded,
  isPledgeResultsPending,
} from '@/lib/fixtures';
import { solToLamports, truncateAddress, utf8ByteLength } from '@/lib/format';
import { formatImpliedChip, impliedPct, type MarketOdds } from '@/lib/odds';
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

function ThresholdStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary h-10 w-10 shrink-0 px-0 text-lg"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="Decrease"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center font-mono text-2xl font-black tabular-nums">
          {value}
        </span>
        <button
          type="button"
          className="btn-secondary h-10 w-10 shrink-0 px-0 text-lg"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CreateCommitmentForm({
  fixture,
  matchFinalised,
  statusId,
}: {
  fixture: Fixture;
  matchFinalised?: boolean;
  statusId?: number | null;
}) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const escrow = useEscrow();
  const ready = Boolean(connected && publicKey && escrow);

  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<number | null>(null);
  const [includePens, setIncludePens] = useState(false);
  const [team, setTeam] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(2);
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [odds, setOdds] = useState<MarketOdds | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOdds(fixture.fixtureId)
      .then((o) => {
        if (!cancelled) setOdds(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fixture.fixtureId]);

  const now = Date.now();
  const worldCup = isKnockoutWorldCupFixture(fixture);
  const bucket = fixtureBucket(fixture, now);
  const ended = isMatchEnded(fixture, { finalised: matchFinalised, statusId }, now);
  const resultsPending = isPledgeResultsPending(
    fixture,
    { finalised: matchFinalised, statusId },
    now,
  );
  const creatable = canCreatePledge(fixture, now) && !ended;

  const selected: ConditionOption | undefined = useMemo(
    () => CONDITION_OPTIONS.find((o) => o.template === template),
    [template],
  );

  /** Team wins + include pens → shootout template; otherwise the selected template. */
  const effectiveTemplate = useMemo(() => {
    if (template === TEMPLATE_TEAM_WINS && includePens) return TEMPLATE_WINS_ON_PENS;
    return template;
  }, [template, includePens]);

  const param = useMemo(() => {
    if (effectiveTemplate == null) return 0;
    const n = selected?.needsThreshold
      ? Math.min(selected.maxN ?? 10, Math.max(selected.minN ?? 1, threshold))
      : threshold;
    return buildConditionParam(effectiveTemplate, team, n);
  }, [effectiveTemplate, team, threshold, selected]);

  const label = useMemo(
    () =>
      effectiveTemplate == null
        ? ''
        : conditionLabel(effectiveTemplate, param, fixture.homeTeam, fixture.awayTeam),
    [effectiveTemplate, param, fixture],
  );

  const defaultName = useMemo(() => {
    if (!label) return 'Match pledge';
    if (label.length <= 64) return label;
    return `${label.slice(0, 61)}…`;
  }, [label]);

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
  const step1Valid = template != null;

  function pickTemplate(opt: ConditionOption) {
    setTemplate(opt.template);
    setIncludePens(false);
    if (opt.needsThreshold) {
      const mid = Math.round(((opt.minN ?? 1) + (opt.maxN ?? 5)) / 2);
      setThreshold(mid);
    }
  }

  async function signAndLock() {
    if (!ready || !escrow) return;
    if (effectiveTemplate == null || !step2Valid) return;
    if (!canCreatePledge(fixture)) return;
    setSubmitting(true);
    try {
      const { txSig, commitment } = await escrow.createCommitment({
        fixtureId: fixture.fixtureId,
        kickoffTs: Math.floor(fixture.kickoffTs / 1000),
        conditionTemplate: effectiveTemplate,
        conditionParam: param,
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

  if (!worldCup) {
    return (
      <div className="card p-6 font-sans text-sm text-muted">
        Pledges are knockout World Cup only (Round of 32 onward). Group stage
        and other competitions are not available.
      </div>
    );
  }

  if (ended || bucket === 'finished' || resultsPending) {
    return null;
  }

  if (!creatable) {
    return (
      <div className="card p-6 font-sans text-sm text-muted">
        {ended ? (
          <>
            This match has ended — new pledges are closed. Open existing
            commitments on the pledge board to resolve or claim.
          </>
        ) : (
          <>
            New pledges are only open on upcoming or live World Cup knockout
            matches.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card p-6 font-sans sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-ink">Create a commitment</h2>
        <StepDots step={step} />
      </div>
      <p className="mb-4 text-xs text-muted">
        Create as many pledges as you like while the match is upcoming or live ·
        settle after full time via TxLINE proof
      </p>

      {step === 1 && (
        <div>
          <p className="label">Step 1 — Build condition</p>
          <div className="flex flex-col gap-2">
            {CONDITION_OPTIONS.map((opt) => {
              const active = template === opt.template;
              const chipParam = buildConditionParam(
                opt.template === TEMPLATE_TEAM_WINS && includePens
                  ? TEMPLATE_WINS_ON_PENS
                  : opt.template,
                team,
                opt.needsThreshold
                  ? Math.min(opt.maxN ?? 10, Math.max(opt.minN ?? 1, threshold))
                  : 0,
              );
              const chipTpl =
                opt.template === TEMPLATE_TEAM_WINS && includePens && active
                  ? TEMPLATE_WINS_ON_PENS
                  : opt.template;
              const pct = impliedPct(odds, chipTpl, chipParam);
              return (
                <button
                  key={opt.template}
                  type="button"
                  onClick={() => pickTemplate(opt)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? 'border-pitch-500 bg-pitch-500/10'
                      : 'border-edge bg-raised/60 hover:border-pitch-700'
                  }`}
                >
                  <p className="text-sm font-bold text-ink">{opt.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{opt.blurb}</p>
                  {pct != null && (
                    <p className="mt-2 inline-flex rounded-lg border border-pitch-700/40 bg-pitch-500/10 px-2 py-0.5 text-[11px] font-semibold text-pitch-400">
                      {formatImpliedChip(pct)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Market pulse from TxLINE consensus odds — context, not a promise. Your
            pledge settles on the final result only.
          </p>

          {selected?.needsTeam && (
            <div className="mt-4 rounded-xl border border-edge bg-raised/50 p-4">
              <p className="label">Team</p>
              <div className="flex flex-wrap gap-2">
                {[fixture.homeTeam, fixture.awayTeam].map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTeam(i)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      team === i
                        ? 'border-pitch-500 bg-pitch-500/15 text-pitch-400'
                        : 'border-edge text-muted hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {template === TEMPLATE_TEAM_WINS && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-edge pt-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Include penalties</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {includePens
                        ? 'Settle on the shootout only (full-time goals ignored).'
                        : 'Settle on goals after FT/ET — shootout does not count.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includePens}
                    aria-label="Include penalties"
                    onClick={() => setIncludePens((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      includePens ? 'bg-pitch-500' : 'bg-edge'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-ink shadow transition-transform ${
                        includePens ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}

              {template === TEMPLATE_TEAM_WINS && (
                <p className="mt-3 text-xs italic text-amber-400/90">
                  {includePens ? PENS_DISCLOSURE : SHOOTOUT_DISCLOSURE}
                </p>
              )}
              {template === TEMPLATE_WINS_BY_AT_LEAST && (
                <p className="mt-3 text-xs italic text-amber-400/90">
                  {SHOOTOUT_DISCLOSURE}
                </p>
              )}
            </div>
          )}

          {selected?.disclosure === 'goals' &&
            template != null &&
            template !== TEMPLATE_TEAM_WINS &&
            template !== TEMPLATE_WINS_BY_AT_LEAST && (
              <p className="mt-3 text-xs text-muted">{GOALS_DISCLOSURE}</p>
            )}
          {selected?.disclosure === 'pens' && (
            <p className="mt-3 text-xs italic text-amber-400/90">{PENS_DISCLOSURE}</p>
          )}

          {selected?.needsThreshold && (
            <div className="mt-4 rounded-xl border border-edge bg-raised/50 p-4">
              <ThresholdStepper
                label={selected.thresholdLabel ?? 'Value'}
                value={Math.min(
                  selected.maxN ?? 10,
                  Math.max(selected.minN ?? 1, threshold),
                )}
                min={selected.minN ?? 1}
                max={selected.maxN ?? 10}
                onChange={setThreshold}
              />
            </div>
          )}

          {template != null && (
            <p className="mt-4 rounded-xl border border-pitch-600/30 bg-pitch-500/10 px-4 py-3 text-sm font-semibold text-pitch-300">
              Preview: {label}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="btn-primary"
              disabled={!step1Valid}
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
            {beneficiaryValid && (
              <a
                href={explorerAddressUrl(beneficiary)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-pitch-400 hover:underline"
              >
                Verify beneficiary on explorer ↗
              </a>
            )}
            <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              This address is unverified and cannot be changed after you sign.
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
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!step2Valid}
              onClick={() => setStep(3)}
            >
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep(2)}
              disabled={submitting}
            >
              Back
            </button>
            {ready ? (
              <button
                type="button"
                className="btn-primary"
                onClick={signAndLock}
                disabled={submitting}
              >
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
