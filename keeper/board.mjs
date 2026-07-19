// Indexer-lite: board/claims/fixtures queries served straight from chain scans
// plus a cached TxLINE fixtures snapshot. At hackathon scale (dozens of
// commitments, 24KB each) a getProgramAccounts scan is instant; Postgres would
// be pure ceremony. On-chain state remains the single source of truth (FR-14.5).
import anchor from "@coral-xyz/anchor";

const STATUS = ["Open", "Executed", "Refunded", "Void", "Closed"];
const TEMPLATES = ["BTTS", "TeamWins", "TotalGoals"];

const SCAN_TTL_MS = 4_000;      // commitment scan cache
const FIXTURE_TTL_MS = 300_000; // TxLINE fixtures snapshot cache

export function makeBoard({ tifo, api }) {
  let scanCache = { at: 0, rows: [] };
  let fixtureCache = { at: 0, rows: [] };

  async function allCommitments() {
    if (Date.now() - scanCache.at < SCAN_TTL_MS) return scanCache.rows;
    const raw = await tifo.account.commitment.all();
    const rows = raw.map(({ publicKey, account: a }) => {
      const members = [];
      for (const m of a.members) {
        if (m.wallet.equals(anchor.web3.PublicKey.default)) break;
        members.push({
          wallet: m.wallet.toBase58(),
          depositLamports: Number(m.depositLamports),
          withdrawn: m.withdrawn === 1,
          claimed: m.claimed === 1,
        });
      }
      const active = members.filter((m) => !m.withdrawn);
      return {
        pubkey: publicKey.toBase58(),
        fixtureId: Number(a.fixtureId),
        kickoffTs: Number(a.kickoffTs),
        conditionTemplate: a.conditionTemplate,
        conditionParam: Number(a.conditionParam),
        conditionType: TEMPLATES[a.conditionTemplate] ?? "Unknown",
        beneficiary: a.beneficiary.toBase58(),
        founder: a.founder.toBase58(),
        name: Buffer.from(a.name).toString("utf8").replace(/\0+$/, ""),
        status: STATUS[a.status] ?? "Unknown",
        memberCount: a.memberCount,
        totalLamports: active.reduce((s, m) => s + m.depositLamports, 0),
        members,
      };
    });
    scanCache = { at: Date.now(), rows };
    return rows;
  }

  async function fixtures() {
    if (Date.now() - fixtureCache.at < FIXTURE_TTL_MS) return fixtureCache.rows;
    const { data } = await api.get("/fixtures/snapshot");
    const list = Array.isArray(data) ? data : data.fixtures ?? [];
    const rows = list.map((f) => ({
      fixtureId: f.FixtureId ?? f.fixtureId,
      home: f.Participant1 ?? f.participant1 ?? "Home",
      away: f.Participant2 ?? f.participant2 ?? "Away",
      startTime: f.StartTime ?? f.startTime,
      competitionId: f.CompetitionId ?? f.competitionId,
    }));
    fixtureCache = { at: Date.now(), rows };
    return rows;
  }

  return {
    // GET /api/board?status=&fixture_id=&sort=&limit=&offset=
    async board(params) {
      let rows = await allCommitments();
      const status = params.get("status");
      const fixtureId = params.get("fixture_id");
      if (status) rows = rows.filter((r) => r.status === status);
      if (fixtureId) rows = rows.filter((r) => r.fixtureId === Number(fixtureId));
      const sort = params.get("sort") ?? "total_lamports";
      const key = { total_lamports: "totalLamports", member_count: "memberCount", kickoff_ts: "kickoffTs" }[sort] ?? "totalLamports";
      rows = [...rows].sort((a, b) => b[key] - a[key]);
      const offset = Number(params.get("offset") ?? 0);
      const limit = Number(params.get("limit") ?? 50);
      // strip full member lists from list view
      return rows.slice(offset, offset + limit).map(({ members, ...r }) => ({ ...r }));
    },

    // GET /api/commitment/:pubkey
    async commitment(pubkey) {
      const rows = await allCommitments();
      return rows.find((r) => r.pubkey === pubkey) ?? null;
    },

    // GET /api/claims?wallet=
    async claims(wallet) {
      const rows = await allCommitments();
      const out = [];
      for (const r of rows) {
        if (r.status !== "Refunded" && r.status !== "Void") continue;
        const m = r.members.find((m) => m.wallet === wallet && !m.withdrawn && !m.claimed);
        if (m) out.push({
          pubkey: r.pubkey, fixtureId: r.fixtureId, name: r.name,
          conditionType: r.conditionType, status: r.status,
          amountLamports: m.depositLamports,
        });
      }
      return out;
    },

    fixtures,
    invalidate() { scanCache.at = 0; },
  };
}
