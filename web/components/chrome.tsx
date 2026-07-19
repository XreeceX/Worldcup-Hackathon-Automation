"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClaims, useFeed, useFixtures, fixtureLabel, type FeedEvent } from "@/lib/api";
import { truncate, explorerTx } from "@/lib/config";
import { programId } from "@/lib/anchor";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

// ---------- toasts ----------
type Toast = { id: number; text: string; href?: string; kind?: "ok" | "err" };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Chrome({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      <Header />
      <Ticker />
      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-6">{children}</main>
      <footer className="border-t border-line-600 px-4 py-6 text-center text-xs text-chalk-600">
        <span className="mono">{programId.toBase58()}</span> · Settled by TxLINE Merkle proofs on Solana devnet
      </footer>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-lg border px-4 py-3 text-sm shadow-lg bg-pitch-700 ${
                t.kind === "err" ? "border-loss-400/50 text-loss-400" : "border-line-600 text-chalk-100"
              }`}
            >
              {t.text}
              {t.href && (
                <a href={t.href} target="_blank" className="ml-2 text-info-400 underline" rel="noreferrer">
                  view tx ↗
                </a>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function Header() {
  const { publicKey } = useWallet();
  const { data: claims } = useClaims(publicKey?.toBase58());
  const pending = claims?.length ?? 0;
  return (
    <header className="sticky top-0 z-40 border-b border-line-600 bg-pitch-900/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4">
        <Link href="/" className="display text-xl font-extrabold tracking-tight">
          TIF<span className="inline-block h-[0.72em] w-[0.72em] translate-y-[0.06em] rounded-full border-[3px] border-current" aria-label="O" />
        </Link>
        <nav className="flex gap-4 text-sm text-chalk-400">
          <Link href="/" className="hover:text-chalk-100">The Board</Link>
          <Link href="/matches" className="hover:text-chalk-100">Matches</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {pending > 0 && (
            <Link
              href="/claims"
              className="flex items-center gap-2 rounded-full border border-loss-400/40 bg-pitch-700 px-3 py-1.5 text-xs text-chalk-100"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-loss-400" />
              {pending} claim{pending > 1 ? "s" : ""}
            </Link>
          )}
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}

function Ticker() {
  const events = useFeed();
  const { fixtures } = useFixtures();
  if (events.length === 0) return null;
  const items = events.slice(0, 12).map(feedLine(fixtures));
  const row = [...items, ...items]; // duplicated for seamless marquee
  return (
    <div className="overflow-hidden border-b border-line-600 bg-pitch-900">
      <div className="marquee flex w-max gap-8 whitespace-nowrap px-4 py-1.5 text-xs text-chalk-400">
        {row.map((it, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="pulse-dot" style={{ width: 6, height: 6 }} />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function feedLine(fixtures: ReturnType<typeof useFixtures>["fixtures"]) {
  return (e: FeedEvent) => {
    const f = fixtureLabel(fixtures, e.fixtureId);
    const match = `${f.home} vs ${f.away}`;
    if (e.type === "resolved" && e.conditionMet)
      return `RELEASED · ${e.name || "pledge"} → ${truncate(e.beneficiary)} · ${match}`;
    if (e.type === "resolved") return `NOT MET · ${e.name || "pledge"} refundable · ${match}`;
    return `${e.type} · ${match}`;
  };
}

// ---------- shared bits ----------
export function StatusChip({ status, live }: { status: string; live?: boolean }) {
  if (live) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-turf-500/50 px-2 py-0.5 text-[11px] font-semibold text-turf-400">
        <span className="pulse-dot" style={{ width: 6, height: 6 }} /> LIVE
      </span>
    );
  }
  const styles: Record<string, string> = {
    Open: "border-line-600 text-chalk-400",
    Executed: "border-gold-400/60 bg-gold-400/10 text-gold-400",
    Refunded: "border-loss-400/50 text-loss-400",
    Void: "border-voidc-400/50 text-voidc-400",
    Closed: "border-line-600 text-chalk-600",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[status] ?? styles.Open}`}>
      {status === "Executed" ? "Executed ✓" : status}
    </span>
  );
}

export function AddressLink({ addr, className = "" }: { addr: string; className?: string }) {
  return (
    <a
      href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
      target="_blank"
      rel="noreferrer"
      className={`mono text-info-400 hover:underline ${className}`}
      title={addr}
    >
      {truncate(addr)}
    </a>
  );
}

export function TxLink({ sig, children }: { sig: string; children?: React.ReactNode }) {
  return (
    <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className="text-info-400 hover:underline">
      {children ?? "View on Solana Explorer ↗"}
    </a>
  );
}
