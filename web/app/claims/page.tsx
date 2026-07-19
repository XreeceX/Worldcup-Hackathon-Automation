"use client";
import Link from "next/link";
import { useState } from "react";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { useClaims, useFixtures, fixtureLabel } from "@/lib/api";
import { claimRefund, programErrorMessage } from "@/lib/anchor";
import { fmtSol, explorerTx } from "@/lib/config";
import { StatusChip, useToast } from "@/components/chrome";

export default function ClaimsPage() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const { data: claims, mutate } = useClaims(publicKey?.toBase58());
  const { fixtures } = useFixtures();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (!publicKey) {
    return <div className="py-24 text-center text-chalk-400">Connect a wallet to see your claims.</div>;
  }
  const total = (claims ?? []).reduce((s, c) => s + c.amountLamports, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display py-4 text-2xl font-extrabold">
        {total > 0 ? <>You have <span className="text-gold-400">{fmtSol(total)}</span> to collect</> : "Claims"}
      </h1>
      {(claims ?? []).length === 0 ? (
        <p className="text-sm text-chalk-400">
          Nothing to collect — everything you&rsquo;ve pledged is still in play or already released. ✓
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(claims ?? []).map((c) => {
            const f = fixtureLabel(fixtures, c.fixtureId);
            return (
              <div key={c.pubkey} className="flex items-center justify-between rounded-xl border border-line-600 bg-pitch-800 p-4">
                <div>
                  <Link href={`/commitment/${c.pubkey}`} className="display font-semibold hover:underline">
                    {c.name || `${c.conditionType} pledge`}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-chalk-400">
                    {f.home} vs {f.away} <StatusChip status={c.status} />
                  </div>
                </div>
                <button
                  disabled={busy === c.pubkey}
                  onClick={async () => {
                    if (!wallet) return;
                    setBusy(c.pubkey);
                    try {
                      const sig = await claimRefund(wallet, c.pubkey);
                      toast({ text: `Claimed ${fmtSol(c.amountLamports)}.`, href: explorerTx(sig) });
                      mutate();
                    } catch (e) { toast({ text: programErrorMessage(e), kind: "err" }); }
                    finally { setBusy(null); }
                  }}
                  className="rounded-lg bg-turf-500 px-4 py-2 text-sm font-semibold text-pitch-950 disabled:opacity-50"
                >
                  Claim {fmtSol(c.amountLamports)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
