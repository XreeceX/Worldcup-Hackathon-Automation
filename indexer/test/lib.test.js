import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodePackedFixtureId,
  conditionLabel,
  decodeName,
  buildBoardQuery,
  mapFixtureRecord,
  fixtureBucket,
} from '../src/lib.js';

test('decodePackedFixtureId: unpacked id passes through with gameState 0', () => {
  const { pureFixtureId, gameState } = decodePackedFixtureId(18257865);
  assert.equal(pureFixtureId, 18257865n);
  assert.equal(gameState, 0);
});

test('decodePackedFixtureId: extracts gameState from top bits', () => {
  const packed = 16n * (1n << 48n) + 18257865n; // gameState 16 = Cancelled
  const { pureFixtureId, gameState } = decodePackedFixtureId(packed);
  assert.equal(pureFixtureId, 18257865n);
  assert.equal(gameState, 16);
});

test('decodePackedFixtureId: gameState 5 (Ended)', () => {
  const packed = 5 * 281474976710656 + 12345;
  const { pureFixtureId, gameState } = decodePackedFixtureId(packed);
  assert.equal(pureFixtureId, 12345n);
  assert.equal(gameState, 5);
});

test('conditionLabel: template 0 is BTTS regardless of param/teams', () => {
  assert.equal(conditionLabel(0, 0, 'France', 'England'), 'Both teams score');
  assert.equal(conditionLabel(0, 1), 'Both teams score');
});

test('conditionLabel: template 1 uses team names', () => {
  assert.equal(conditionLabel(1, 0, 'France', 'England'), 'France wins');
  assert.equal(conditionLabel(1, 1, 'France', 'England'), 'England wins');
});

test('conditionLabel: template 1 falls back to generic names', () => {
  assert.equal(conditionLabel(1, 0), 'Home team wins');
  assert.equal(conditionLabel(1, 1, null, undefined), 'Away team wins');
});

test('conditionLabel: unknown template', () => {
  assert.equal(conditionLabel(99, 0, 'A', 'B'), 'Unknown condition');
});

test('conditionLabel: templates 2–7', () => {
  assert.equal(conditionLabel(2, 0), 'Draw (full time)');
  assert.equal(conditionLabel(3, 2, 'Spain', 'Argentina'), 'Spain scores at least 2');
  assert.equal(conditionLabel(3, 256 + 3, 'Spain', 'Argentina'), 'Argentina scores at least 3');
  assert.equal(conditionLabel(4, 4), 'Total goals ≥ 4');
  assert.equal(conditionLabel(5, 256 + 2, 'Spain', 'Argentina'), 'Argentina wins by ≥ 2');
  assert.equal(conditionLabel(6, 0, 'Spain', 'Argentina'), 'Spain wins on penalties');
  assert.equal(conditionLabel(7, 0), 'Goes to penalties');
});

test('decodeName: strips trailing nulls', () => {
  const bytes = new Uint8Array(64);
  const label = Buffer.from('Argentina DAO', 'utf8');
  label.copy(bytes);
  assert.equal(decodeName(bytes), 'Argentina DAO');
});

test('decodeName: plain number arrays, utf-8, all-zero', () => {
  assert.equal(decodeName([72, 105, 0, 0]), 'Hi');
  const heart = [...Buffer.from('♥ FC', 'utf8'), 0, 0, 0];
  assert.equal(decodeName(heart), '♥ FC');
  assert.equal(decodeName(new Uint8Array(64)), '');
  // interior nulls are preserved; only the padding is stripped
  assert.equal(decodeName([65, 0, 66, 0, 0]), 'A\u0000B');
});

test('buildBoardQuery: defaults', () => {
  const { text, values } = buildBoardQuery({});
  assert.match(text, /ORDER BY c\.total_lamports DESC/);
  assert.doesNotMatch(text, /WHERE/);
  assert.deepEqual(values, [50, 0]);
});

test('buildBoardQuery: status + fixture filters are parameterised', () => {
  const { text, values } = buildBoardQuery({ status: 'Open', fixtureId: '18257865' });
  assert.match(text, /WHERE c\.status = \$1 AND c\.fixture_id = \$2/);
  assert.deepEqual(values, ['Open', '18257865', 50, 0]);
});

test('buildBoardQuery: sort and pagination', () => {
  const { text, values } = buildBoardQuery({ sort: 'member_count', limit: 10, offset: 20 });
  assert.match(text, /ORDER BY c\.member_count DESC/);
  assert.match(text, /LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(values, [10, 20]);
});

test('buildBoardQuery: rejects injection attempts', () => {
  assert.throws(() => buildBoardQuery({ status: "Open'; DROP TABLE commitments;--" }));
  assert.throws(() => buildBoardQuery({ sort: 'pubkey; DELETE FROM fixtures' }));
  assert.throws(() => buildBoardQuery({ fixtureId: '1 OR 1=1' }));
});

test('buildBoardQuery: limit is clamped', () => {
  assert.equal(buildBoardQuery({ limit: 100000 }).values[0], 200);
  assert.equal(buildBoardQuery({ limit: -5 }).values[0], 1);
});

test('mapFixtureRecord: packed id + participant names + StartTime', () => {
  const packed = 2 * 281474976710656 + 18257865; // gameState 2 = H1
  const f = mapFixtureRecord({
    FixtureId: packed,
    participant1: 'France',
    participant2: 'England',
    competition: 'World Cup',
    StartTime: 1784840400000,
  });
  assert.deepEqual(f, {
    fixtureId: '18257865',
    gameState: 2,
    homeTeam: 'France',
    awayTeam: 'England',
    competition: 'World Cup',
    kickoffTs: 1784840400000,
  });
});

test('mapFixtureRecord: tolerates missing fields and object team shapes', () => {
  const f = mapFixtureRecord({ fixtureId: 42, participant1: { name: 'Brazil' } });
  assert.equal(f.fixtureId, '42');
  assert.equal(f.homeTeam, 'Brazil');
  assert.equal(f.awayTeam, 'Away team');
  assert.equal(f.competition, 'Unknown');
  assert.equal(f.kickoffTs, 0);
});

test('mapFixtureRecord: returns null without a fixture id', () => {
  assert.equal(mapFixtureRecord({ participant1: 'A' }), null);
  assert.equal(mapFixtureRecord(null), null);
  assert.equal(mapFixtureRecord('junk'), null);
});

test('fixtureBucket: upcoming / live / finished', () => {
  const now = 1_784_840_400_000;
  assert.equal(fixtureBucket(1, now + 3_600_000, now), 'upcoming'); // NS, future kickoff
  assert.equal(fixtureBucket(1, now - 3_600_000, now), 'live'); // NS, kicked off 1h ago
  assert.equal(fixtureBucket(2, now - 1_000, now), 'live'); // H1
  assert.equal(fixtureBucket(5, now - 7_200_000, now), 'finished'); // Ended
  assert.equal(fixtureBucket(16, now + 3_600_000, now), 'finished'); // Cancelled
  // stale game_state 0 past est. FT (~105m) → finished, not live
  assert.equal(fixtureBucket(0, now - 2 * 3_600_000, now), 'finished');
  assert.equal(fixtureBucket(0, now - 6 * 3_600_000, now), 'finished');
  // explicit in-play after est. FT still live (ET / pens)
  assert.equal(fixtureBucket(8, now - 2 * 3_600_000, now), 'live');
});
