import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadFixture } from '../../harness/fixtures.mjs';
import { evaluateResult } from '../../harness/evaluate.mjs';
import { FIXTURES } from './helpers.mjs';

const tapsFixture = () => loadFixture(FIXTURES, 'taps');
const androidResult = () => JSON.parse(readFileSync(join(FIXTURES, 'taps.android.result.json'), 'utf8'));

test('the committed android sample satisfies its fixture', () => {
  assert.deepEqual(evaluateResult(tapsFixture(), androidResult()), []);
});

test('expect fields map to concrete diffs', () => {
  const fixture = tapsFixture();
  const r = androidResult();
  r.renders = r.renders.slice(0, 1); // one render too few
  r.title = 'wrong';
  r.trace = ['render'];
  r.dump = null;
  const diffs = evaluateResult(fixture, r);
  const paths = diffs.map((d) => d.path);
  assert.ok(paths.includes('renders'));
  assert.ok(paths.includes('title'));
  assert.ok(paths.includes('trace'));
  assert.ok(paths.includes('dump'));
  assert.ok(paths.includes('text[0].data')); // finalDump holds 'Taps: 1', the single render says 'Taps: 0'
  assert.ok(paths.includes('channels.__jsr_set_title'));
});

test('result errors and dump deltas become diffs', () => {
  const fixture = tapsFixture();
  const r = androidResult();
  r.error = 'engine exploded';
  r.finalDump.children[0].props.data = 'Taps: 7';
  const diffs = evaluateResult(fixture, r);
  assert.ok(diffs.some((d) => d.path === 'error'));
  assert.ok(diffs.some((d) => d.path === 'text[0].data'));
});

test('a SKIP result is not evaluated (compare handles it)', () => {
  const diffs = evaluateResult(tapsFixture(), {
    fixture: 'taps', platform: 'android', status: 'SKIP', renders: [], trace: [],
  });
  // evaluateResult judges the data; a SKIP never reaches it in the CLI
  assert.ok(diffs.length > 0);
});
