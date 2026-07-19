-- Schema per design-01.md §8.2 — applied automatically on boot when tables are missing.

-- Fixture metadata from TxLINE /fixtures/snapshot
CREATE TABLE fixtures (
  fixture_id    BIGINT PRIMARY KEY,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  competition   TEXT NOT NULL,
  kickoff_ts    BIGINT NOT NULL,    -- Unix ms
  game_state    SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE commitments (
  pubkey             TEXT PRIMARY KEY,
  fixture_id         BIGINT NOT NULL REFERENCES fixtures(fixture_id),
  kickoff_ts         BIGINT NOT NULL,
  condition_template SMALLINT NOT NULL,
  condition_param    BIGINT NOT NULL,
  condition_label    TEXT NOT NULL,    -- "Both teams score", "Home team wins", "Away team wins"
  beneficiary        TEXT NOT NULL,
  founder            TEXT NOT NULL,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL,   -- Open | Executed | Refunded | Void | Closed
  member_count       INT NOT NULL DEFAULT 0,
  total_lamports     BIGINT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL,
  resolved_at        TIMESTAMPTZ,
  settlement_tx      TEXT             -- Solana tx signature; null until Executed
);

CREATE TABLE commitment_members (
  commitment_pubkey TEXT NOT NULL REFERENCES commitments(pubkey),
  wallet            TEXT NOT NULL,
  deposit_lamports  BIGINT NOT NULL,
  withdrawn         BOOLEAN NOT NULL DEFAULT false,
  claimed           BOOLEAN NOT NULL DEFAULT false,
  joined_at         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (commitment_pubkey, wallet)
);

CREATE INDEX idx_commitments_fixture    ON commitments(fixture_id);
CREATE INDEX idx_commitments_status     ON commitments(status);
CREATE INDEX idx_commitments_lamports   ON commitments(total_lamports DESC);
CREATE INDEX idx_commitments_members    ON commitments(member_count DESC);
CREATE INDEX idx_members_wallet         ON commitment_members(wallet);
CREATE INDEX idx_members_unclaimed      ON commitment_members(wallet, claimed) WHERE claimed = false;
