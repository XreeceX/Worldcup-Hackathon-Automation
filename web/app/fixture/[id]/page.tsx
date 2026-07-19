"use client";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useBoard, useFixtures, fixtureLabel } from "@/lib/api";
import { CommitmentCard } from "@/components/commitment-card";
import { useToast } from "@/components/chrome";
import { createCommitment, programErrorMessage } from "@/lib/anchor";
import { conditionLabel, shootoutDisclosure, TEMPLATE_BTTS, TEMPLATE_TEAM_WINS, TEMPLATE_TOTAL_GOALS } from "@/lib/conditions";
import { flag, explorerTx, truncate } from "@/lib/config";
import { PublicKey } from "@solana/web3.js";

export default function FixturePage() {
  const { id } = useParams<{ id: string }>();
  const fixtureId = Number(id);
  const { fixtures } = useFixtures();
  const { data: rows } = useBoard(`?fixture_id=${fixtureId}`);
  const f = fixtureLabel(fixtures, fixtureId);
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      {/* fixture header */}
      <div className="py-8 text-center">
        <div className="display text-4xl font-black tracking-tight">
          {flag(f.home)} {f.home} <span className="text-chalk-600">vs</span> {f.away} {flag(f.away)}
        </div>
        <div className="mono mt-2 text-sm text-chalk-400">
          {f.startTime ? new Date(f.startTime).toLocaleString() : ""}
        </div>
      </div>

      {!wizardOpen && (
        <div className="mb-8 text-center">
          <button
            onClick={() => setWizardOpen(true)}
            className="rounded-lg bg-turf-500 px-6 py-3 font-semibold text-pitch-950 transition hover:brightness-110"
          >
            Raise a pledge on this match
          </button>
        </div>
      )}

      {wizardOpen && <Wizard fixtureId={fixtureId} home={f.home} away={f.away} startTime={f.startTime} />}

      {(rows ?? []).length > 0 && (
        <>
          <div className="label mb-3 mt-8">Pledges on this match</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(rows ?? []).map((row, i) => (
              <CommitmentCard key={row.pubkey} row={row} fixtures={fixtures} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Wizard({ fixtureId, home, away, startTime }: { fixtureId: number; home: string; away: string; startTime: number }) {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<number | null>(null);
  const [param, setParam] = useState(0);
  const [totalN, setTotalN] = useState(3);
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = useAnchorWallet();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const toast = useToast();
  const router = useRouter();

  const effParam = template === TEMPLATE_TOTAL_GOALS ? totalN : param;
  const label = template === null ? "" : conditionLabel(template, effParam, home, away);
  const beneficiaryValid = useMemo(() => {
    try { new PublicKey(beneficiary); return true; } catch { return false; }
  }, [beneficiary]);
  const amountValid = Number(amount) >= 0.01;

  // Demo-friendly kickoff: use the real start time when it's in the future,
  // otherwise lock 3 minutes from now (program requires kickoff > now).
  const kickoffTs = startTime > Date.now() ? Math.floor(startTime / 1000) : Math.floor(Date.now() / 1000) + 180;

  async function sign() {
    if (!wallet) { setVisible(true); return; }
    setBusy(true);
    try {
      toast({ text: "Waiting for signature…" });
      const { sig, commitment } = await createCommitment(wallet, {
        fixtureId, kickoffTs,
        conditionTemplate: template!, conditionParam: effParam,
        beneficiary, depositLamports: Math.round(Number(amount) * 1e9),
        name: name || `${label} pledge`,
      });
      toast({ text: "Your vow is on the board.", href: explorerTx(sig) });
      router.push(`/commitment/${commitment}`);
    } catch (e) {
      toast({ text: programErrorMessage(e), kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  const Option = ({ t, title, desc, children }: { t: number; title: string; desc: string; children?: React.ReactNode }) => (
    <button
      onClick={() => setTemplate(t)}
      className={`rounded-xl border p-5 text-left transition ${
        template === t ? "border-turf-500 shadow-[0_0_20px_var(--turf-glow)]" : "border-line-600 hover:border-chalk-600"
      } bg-pitch-800`}
    >
      <div className="display text-lg font-bold">{title}</div>
      <div className="mt-1 text-sm text-chalk-400">{desc}</div>
      {children}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line-600 bg-pitch-900 p-6">
      <div className="mb-5 flex items-center gap-2 text-xs text-chalk-600">
        {["Condition", "Cause", "Lock it in"].map((s, i) => (
          <span key={s} className={`flex items-center gap-2 ${step === i + 1 ? "text-turf-400" : ""}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${step > i ? "border-turf-500 text-turf-400" : "border-line-600"}`}>{i + 1}</span>
            {s} {i < 2 && <span className="text-line-600">—</span>}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Option t={TEMPLATE_BTTS} title="⚽⚽ Both teams score" desc="Each side finds the net at least once." />
            <Option t={TEMPLATE_TEAM_WINS} title="🏆 Team wins" desc="Your team has more goals at the whistle.">
              {template === TEMPLATE_TEAM_WINS && (
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {[home, away].map((team, i) => (
                    <span
                      key={team}
                      onClick={() => setParam(i)}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${param === i ? "border-turf-500 text-turf-400" : "border-line-600 text-chalk-400"}`}
                    >
                      {flag(team)} {team}
                    </span>
                  ))}
                </div>
              )}
            </Option>
            <Option t={TEMPLATE_TOTAL_GOALS} title="🥅 Goal fest" desc="N or more total goals in the match.">
              {template === TEMPLATE_TOTAL_GOALS && (
                <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {[2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      onClick={() => setTotalN(n)}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${totalN === n ? "border-turf-500 text-turf-400" : "border-line-600 text-chalk-400"}`}
                    >
                      {n}+
                    </span>
                  ))}
                </div>
              )}
            </Option>
          </div>
          {template === TEMPLATE_TEAM_WINS && (
            <p className="mt-3 text-xs text-chalk-600">{shootoutDisclosure}</p>
          )}
          {template !== null && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-chalk-400">
                You&rsquo;re pledging that <span className="font-semibold text-chalk-100">{label}</span>.
              </p>
              <button onClick={() => setStep(2)} className="rounded-lg bg-turf-500 px-5 py-2 font-semibold text-pitch-950">
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex max-w-md flex-col gap-4">
          <div>
            <div className="label mb-1">Beneficiary address</div>
            <input
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value.trim())}
              placeholder="Paste a Solana address"
              className="mono w-full rounded-lg border border-line-600 bg-pitch-800 px-3 py-2.5 text-sm outline-none focus:border-info-400"
            />
            <div className="mt-2 border-l-2 border-gold-400 bg-gold-400/5 px-3 py-2 text-xs text-chalk-400">
              This address is unverified and cannot be changed after you sign. Funds sent here are permanent.
              {beneficiaryValid && (
                <a
                  href={`https://explorer.solana.com/address/${beneficiary}?cluster=devnet`}
                  target="_blank" rel="noreferrer" className="ml-1 text-info-400 underline"
                >
                  verify this address yourself ↗
                </a>
              )}
            </div>
          </div>
          <div>
            <div className="label mb-1">Amount (SOL)</div>
            <div className="flex items-center gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="mono w-28 rounded-lg border border-line-600 bg-pitch-800 px-3 py-2.5 text-lg outline-none focus:border-info-400"
              />
              {["0.1", "0.5", "1"].map((a) => (
                <button key={a} onClick={() => setAmount(a)} className="rounded-full border border-line-600 px-3 py-1 text-xs text-chalk-400 hover:text-chalk-100">
                  {a}
                </button>
              ))}
            </div>
            {!amountValid && <p className="mt-1 text-xs text-loss-400">Minimum deposit is 0.01 SOL.</p>}
          </div>
          <div>
            <div className="label mb-1">Name (optional)</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 64))}
              placeholder={`${param === 0 ? home : away} DAO`}
              className="w-full rounded-lg border border-line-600 bg-pitch-800 px-3 py-2.5 text-sm outline-none focus:border-info-400"
            />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-chalk-400 hover:text-chalk-100">← Back</button>
            <button
              disabled={!beneficiaryValid || !amountValid}
              onClick={() => setStep(3)}
              className="rounded-lg bg-turf-500 px-5 py-2 font-semibold text-pitch-950 disabled:opacity-40"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mx-auto max-w-md">
          <div className="receipt-edge rounded-xl border border-line-600 bg-pitch-800 p-5">
            <div className="label">Pledge card</div>
            <div className="display mt-2 text-xl font-bold">{name || `${label} pledge`}</div>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <Row k="Match" v={`${home} vs ${away}`} />
              <Row k="Condition" v={label} />
              <Row k="Beneficiary" v={truncate(beneficiary, 8)} mono />
              <Row k="Amount" v={`${amount} SOL`} mono />
            </dl>
            <p className="mt-4 border-t border-line-600 pt-3 text-xs text-chalk-600">
              Settles automatically by TxLINE Merkle proof. No one — including us — can redirect these funds.
            </p>
          </div>
          <div className="mt-4 flex justify-between">
            <button onClick={() => setStep(2)} className="text-sm text-chalk-400 hover:text-chalk-100">← Back</button>
            <button
              onClick={sign}
              disabled={busy}
              className="rounded-lg bg-turf-500 px-6 py-2.5 font-semibold text-pitch-950 disabled:opacity-50"
            >
              {busy ? "Confirming…" : connected ? "Sign & lock" : "Connect wallet to sign"}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Row({ k, v, mono: isMono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-chalk-600">{k}</dt>
      <dd className={`text-right ${isMono ? "mono" : ""}`}>{v}</dd>
    </div>
  );
}
