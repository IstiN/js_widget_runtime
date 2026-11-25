import test from 'node:test';
import assert from 'node:assert/strict';
import { weightFor, scoreRows } from '../../harness/score.mjs';
import { renderReport, renderBadge } from '../../harness/report.mjs';

const row = (fixture, level, status, diffs = [], weight = 1) => ({ fixture, level, status, diffs, weight });

test('fixture weight is the maximum of its categories', () => {
  assert.equal(weightFor(['L0']), 1);
  assert.equal(weightFor(['L0', 'L1']), 2);
  assert.equal(weightFor(['L1', 'L2']), 3);
  assert.equal(weightFor(['L4']), 5);
  assert.equal(weightFor(['3D-API']), 2);
  assert.equal(weightFor(['3D-RENDER']), 1); // unknown -> 1
  assert.equal(weightFor([]), 1);
});

test('score weights passes and fails, excludes SKIP', () => {
  const rows = [
    { status: 'PASS', weight: 3 },
    { status: 'FAIL', weight: 2 },
    { status: 'SKIP', weight: 5 },
  ];
  const s = scoreRows(rows);
  assert.equal(s.passed, 1);
  assert.equal(s.failed, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.score, 0.6);
});

test('score is null when nothing is evaluated', () => {
  assert.equal(scoreRows([{ status: 'SKIP', weight: 3 }]).score, null);
  assert.equal(scoreRows([]).score, null);
});

test('report holds the table, rows and the score line', () => {
  const md = renderReport({
    platform: 'android',
    rows: [
      row('taps', 'L1', 'PASS', [], 2),
      row('logic', 'L2', 'FAIL', [{ path: 'text[0].data' }], 3),
      row('offline', 'L2', 'SKIP', [], 3),
    ],
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.match(md, /\| Fixture \| Level \| Status \| Diffs \|/);
  assert.match(md, /\| taps \| L1 \| PASS \| - \|/);
  assert.match(md, /\| logic \| L2 \| FAIL \| 1 \(text\[0\]\.data\) \|/);
  assert.match(md, /\| offline \| L2 \| SKIP \| - \|/);
  assert.match(md, /Score: 40% \(passed 1, failed 1, skipped 1\)/);
  assert.match(md, /Platform: android/);
});

test('score line reads n/a with no evaluated fixtures', () => {
  const md = renderReport({ platform: 'ios', rows: [row('x', 'L1', 'SKIP')] });
  assert.match(md, /Score: n\/a \(passed 0, failed 0, skipped 1\)/);
});

test('badge JSON carries platform, rounded score and counters', () => {
  const badge = renderBadge({
    platform: 'web',
    rows: [row('a', 'L1', 'PASS', [], 2), row('b', 'L4', 'FAIL', [], 5)],
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(badge, { platform: 'web', score: 29, passed: 1, failed: 1, skipped: 0, generatedAt: '2026-01-01T00:00:00.000Z' });
});
