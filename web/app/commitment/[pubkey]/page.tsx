"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  useCommitment, useFixtures, useLiveScore, useFeed, fixtureLabel, triggerResolve, type FeedEvent,
} from "@/lib/api";
import { conditionLabel, liveStatus } from "@/lib/conditions";
import { fmtSol, truncate, flag, explorerTx } from "@/lib/config";
import { StatusChip, AddressLink, TxLink, useToast } from "@/components/chrome";
import {
  joinCommitment, withdrawFromCommitment, claimRefund, voidTimeout, programErrorMessage,
} from "@/lib/anchor";

export default function CommitmentPage() {
  const { pubkey } = useParams<{ pubkey: string }>();
  const { data: c, mutate } = useCommitment(pubkey);
  const { fixtures } = useFixtures();
  const score = useLiveScore(c?.fixtureId);
  const [resolvedEvent, setResolvedEvent] = useState<FeedEvent | null>(null);
  const [ceremony, setCeremony] = useState(false);
  useFeed((e) => {
    if (e.commitment === pubkey && e.type === "resolved") {
      setResolvedEvent(e);
      if (e.conditionMet) setCeremony(true);
      mutate();
    }
  });

  const { publicKey } = useWallet();
  if (!c) return <div className="py-24 text-center text-chalk-600">Loading commitment…</div>;

  const f = fixtureLabel(fixtures, c.fixtureId);
  const label = conditionLabel(c.conditionTemplate, c.conditionParam, f.home, f.away);
  const now = Date.now() / 1000;
  const preKickoff = now < c.kickoffTs;
  const isMember = !!c.members.find((m) => m.wallet === publicKey?.toBase58() && !m.withdrawn);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="display text-2xl font-extrabold">{c.name || `${label} pledge`}</h1>
          <div className="text-sm text-chalk-400">
            {flag(f.home)} {f.home} vs {f.away} {flag(f.away)}
          </div>
        </div>
        <StatusChip status={c.status} live={c.status === "Open" && !preKickoff} />
      </div>

      {/* Zone A — Match Center */}
      <MatchCenter
        c={c} label={label} home={f.home} away={f.away}
        score={score} preKickoff={preKickoff}
        resolvedEvent={resolvedEvent} ceremony={ceremony} onCeremonyDone={() => setCeremony(false)}
      />

      {/* Zone B — Ledger */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Meta k="Condition" v={label} sub={`template ${c.conditionTemplate} · param ${c.conditionParam}`} />
        <Meta k="Beneficiary" v={<AddressLink addr={c.beneficiary} />} sub="receives the vault if the condition is met" />
        <Meta k="Total pledged" v={<span className="mono text-xl">{fmtSol(c.totalLamports)}</span>} sub={`${c.memberCount} member${c.memberCount > 1 ? "s" : ""}`} />
        <Meta k="Kickoff" v={new Date(c.kickoffTs * 1000).toLocaleString()} sub={preKickoff ? "joins open until kickoff" : "membership locked"} />
      </div>

      <div className="label mb-2 mt-6">Members</div>
      <div className="flex flex-col gap-1.5">
        {c.members.filter((m) => !m.withdrawn).map((m) => (
          <div key={m.wallet} className="flex items-center justify-between rounded-lg border border-line-600 bg-pitch-800 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <AddressLink addr={m.wallet} />
              {m.wallet === c.founder && <span className="rounded-full border border-line-600 px-2 py-0.5 text-[10px] text-chalk-600">FOUNDER</span>}
              {m.wallet === publicKey?.toBase58() && <span className="text-[10px] text-turf-400">you</span>}
            </span>
            <span className="mono text-chalk-400">{fmtSol(m.depositLamports)}</span>
          </div>
        ))}
      </div>

      {/* Zone C — Action */}
      <Actions c={c} preKickoff={preKickoff} isMember={isMember} mutate={mutate} />
    </div>
  );
}

function MatchCenter({ c, label, home, away, score, preKickoff, resolvedEvent, ceremony, onCeremonyDone }: {
  c: NonNullable<ReturnType<typeof useCommitment>["data"]>;
  label: string; home: string; away: string;
  score: ReturnType<typeof useLiveScore>;
  preKickoff: boolean;
  resolvedEvent: FeedEvent | null;
  ceremony: boolean;
  onCeremonyDone: () => void;
}) {
  const clock = score.phase ? `(${score.phase})` : "";
  const live = liveStatus(c.conditionTemplate, c.conditionParam, home, away, score.g1, score.g2, clock);
  // A resolved feed event settles the view immediately — don't wait for the next poll
  const settled = (c.status !== "Open" || resolvedEvent !== null) && !ceremony;

  useEffect(() => {
    if (ceremony) {
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.4 }, colors: ["#f5c044", "#17c964", "#f2f5f7"] });
      const t = setTimeout(onCeremonyDone, 4000);
      return () => clearTimeout(t);
    }
  }, [ceremony, onCeremonyDone]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-600 bg-pitch-800 p-6">
      <AnimatePresence>
        {ceremony && resolvedEvent && (
          <motion.div
            key="ceremony"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCeremonyDone}
            className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center bg-pitch-950/95 text-center"
          >
            <div className="text-sm text-chalk-400">&ldquo;{label}&rdquo;</div>
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="display mt-1 text-2xl font-black text-gold-400">
              VERIFIED ✓
            </motion.div>
            <CountUp lamports={c.totalLamports} />
            <div className="mono mt-2 text-sm text-chalk-400">→ {truncate(resolvedEvent.beneficiary, 6)}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {settled ? (
        <ProofReceipt
          c={resolvedEvent && c.status === "Open" ? { ...c, status: resolvedEvent.status } : c}
          label={label} home={home} away={away} resolvedEvent={resolvedEvent} score={score}
        />
      ) : preKickoff ? (
        <Countdown kickoffTs={c.kickoffTs} />
      ) : (
        <div className="text-center">
          <div className="mono display text-6xl font-black tabular-nums">
            {score.g1} <span className="text-chalk-600">–</span> {score.g2}
          </div>
          <div className="mt-1 text-xs text-chalk-600">{home} vs {away} {clock}</div>
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              live.state === "met" ? "border-turf-500/50 bg-turf-500/10 text-turf-400" : "border-line-600 text-chalk-400"
            }`}
          >
            {score.phase === "FT" && resolvedEvent === null
              ? "Full time — awaiting on-chain settlement…"
              : live.text}
          </div>
          {score.events.length > 0 && (
            <div className="mt-4 flex flex-col gap-1 text-left text-xs text-chalk-400">
              {score.events.slice(0, 6).map((e, i) => (
                <motion.div key={`${e.ts}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                  <span className="mono text-chalk-600">{new Date(e.ts).toLocaleTimeString()}</span>{" "}
                  {e.action === "goal" ? "⚽ GOAL" : e.action.replace(/_/g, " ")}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CountUp({ lamports }: { lamports: number }) {
  const [v, setV] = useState(0);
  const target = lamports / 1e9;
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return (
    <div className="mono display mt-3 text-6xl font-black text-gold-400">
      {v.toFixed(3)} <span className="text-3xl">SOL</span>
    </div>
  );
}

function Countdown({ kickoffTs }: { kickoffTs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor(kickoffTs - now / 1000));
  const locked = s === 0;
  const fmt = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((x) => String(x).padStart(2, "0")).join(":");
  return (
    <div className="py-6 text-center">
      <div className="label">{locked ? "Membership" : "Kickoff in"}</div>
      <div className={`mono display mt-1 text-5xl font-black ${locked ? "text-chalk-400" : ""}`}>
        {locked ? "LOCKED 🔒" : fmt}
      </div>
      <p className="mt-2 text-xs text-chalk-600" title="Enforcement is the on-chain clock at the join instruction — this display is cosmetic.">
        {locked ? "No new members after kickoff — enforced on-chain." : "Anyone can join until kickoff. Joining is co-signing."}
      </p>
    </div>
  );
}

function ProofReceipt({ c, label, home, away, resolvedEvent, score }: {
  c: NonNullable<ReturnType<typeof useCommitment>["data"]>;
  label: string; home: string; away: string;
  resolvedEvent: FeedEvent | null; score: ReturnType<typeof useLiveScore>;
}) {
  const yes = c.status === "Executed";
  return (
    <div className="receipt-edge mx-auto max-w-md rounded-xl border border-line-600 bg-pitch-900 p-5">
      <div className="flex items-center justify-between">
        <span className="label">Settlement receipt</span>
        <StatusChip status={c.status} />
      </div>
      <div className="display mt-3 text-lg font-bold">{home} vs {away}</div>
      {(score.g1 > 0 || score.g2 > 0) && (
        <div className="mono text-sm text-chalk-400">final {score.g1}–{score.g2}</div>
      )}
      <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${yes ? "border-gold-400/50 bg-gold-400/10 text-gold-400" : "border-line-600 text-chalk-400"}`}>
        &ldquo;{label}&rdquo; — {yes ? "VERIFIED ✓" : c.status === "Refunded" ? "not met — pledges refundable" : "voided — pledges refundable"}
      </div>
      <ol className="mt-4 flex flex-col gap-1.5 text-xs text-chalk-400">
        <li>✓ Result finalised by TxLINE</li>
        <li>✓ Merkle proof fetched &amp; submitted</li>
        <li>✓ Verified on-chain via validateStatV2 CPI</li>
      </ol>
      {yes && (
        <div className="mono mt-3 border-t border-line-600 pt-3 text-sm">
          {fmtSol(c.totalLamports)} → <AddressLink addr={c.beneficiary} />
        </div>
      )}
      <div className="mt-3 text-sm">
        {resolvedEvent?.txSig ? (
          <TxLink sig={resolvedEvent.txSig} />
        ) : (
          <a
            href={`https://explorer.solana.com/address/${c.pubkey}?cluster=devnet`}
            target="_blank" rel="noreferrer" className="text-info-400 hover:underline"
          >
            View settlement on Solana Explorer ↗
          </a>
        )}
      </div>
    </div>
  );
}

function Meta({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-line-600 bg-pitch-800 p-4">
      <div className="label">{k}</div>
      <div className="mt-1">{v}</div>
      {sub && <div className="mt-0.5 text-xs text-chalk-600">{sub}</div>}
    </div>
  );
}

function Actions({ c, preKickoff, isMember, mutate }: {
  c: NonNullable<ReturnType<typeof useCommitment>["data"]>;
  preKickoff: boolean; isMember: boolean; mutate: () => void;
}) {
  const wallet = useAnchorWallet();
  const { setVisible } = useWalletModal();
  const toast = useToast();
  const { publicKey } = useWallet();
  const [busy, setBusy] = useState(false);
  const [joinAmount, setJoinAmount] = useState("0.1");
  const me = c.members.find((m) => m.wallet === publicKey?.toBase58());
  const canClaim = (c.status === "Refunded" || c.status === "Void") && me && !me.withdrawn && !me.claimed;
  const canTimeout = c.status === "Open" && Date.now() / 1000 >= c.kickoffTs + 7 * 86400 && isMember;
  const postWhistle = c.status === "Open" && !preKickoff;

  async function run(fn: () => Promise<unknown>, okText: string) {
    if (!wallet) { setVisible(true); return; }
    setBusy(true);
    try {
      const sig = await fn();
      toast({ text: okText, href: typeof sig === "string" ? explorerTx(sig) : undefined });
      mutate();
    } catch (e) { toast({ text: programErrorMessage(e), kind: "err" }); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {c.status === "Open" && preKickoff && !isMember && (
        <div className="flex items-center gap-2">
          <input
            value={joinAmount} onChange={(e) => setJoinAmount(e.target.value)} inputMode="decimal"
            className="mono w-24 rounded-lg border border-line-600 bg-pitch-800 px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            onClick={() => run(() => joinCommitment(wallet!, c.pubkey, Math.round(Number(joinAmount) * 1e9)), "You're in. Joining is co-signing.")}
            className="rounded-lg bg-turf-500 px-5 py-2.5 font-semibold text-pitch-950 disabled:opacity-50"
          >
            Join this pledge
          </button>
        </div>
      )}
      {c.status === "Open" && preKickoff && isMember && (
        <button
          disabled={busy}
          onClick={() => run(() => withdrawFromCommitment(wallet!, c.pubkey), "Deposit returned. You've left this commitment.")}
          className="rounded-lg border border-loss-400/50 px-5 py-2.5 text-sm text-loss-400 disabled:opacity-50"
        >
          Withdraw before kickoff
        </button>
      )}
      {postWhistle && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await triggerResolve(c.pubkey); toast({ text: "Resolution submitted — proof verifying on-chain…" }); mutate(); }
            catch (e) { toast({ text: String((e as Error).message), kind: "err" }); }
            finally { setBusy(false); }
          }}
          className="rounded-lg border border-line-600 bg-pitch-700 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          Resolve now
        </button>
      )}
      {canTimeout && (
        <button
          disabled={busy}
          onClick={() => run(() => voidTimeout(wallet!, c.pubkey), "Commitment voided — refunds unlocked.")}
          className="rounded-lg border border-voidc-400/50 px-5 py-2.5 text-sm text-voidc-400 disabled:opacity-50"
        >
          Force void &amp; unlock refunds
        </button>
      )}
      {canClaim && (
        <button
          disabled={busy}
          onClick={() => run(() => claimRefund(wallet!, c.pubkey), "Refund claimed — welcome back.")}
          className="rounded-lg bg-turf-500 px-5 py-2.5 font-semibold text-pitch-950 disabled:opacity-50"
        >
          Claim your {fmtSol(me!.depositLamports)}
        </button>
      )}
    </div>
  );
}
