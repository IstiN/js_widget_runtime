import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli, makeTmp, FIXTURES, STUB } from './helpers.mjs';

// The real-engine tests SKIP when the engine is absent and FAIL when
// JSR_REQUIRE_ENGINE=1 is set.

test('run --engine quickjs replays timers deterministically', async (t) => {
  const bin = process.env.JSR_QJS_HARNESS;
  if (!bin) {
    if (process.env.JSR_REQUIRE_ENGINE === '1') {
      assert.fail('$JSR_QJS_HARNESS is required (JSR_REQUIRE_ENGINE=1) but is not set');
    }
    t.skip('$JSR_QJS_HARNESS not set: quickjs engine test skipped');
    return;
  }
  const out = makeTmp();
  const { code, stderr } = await runCli(['run', '--engine', 'quickjs', '--fixtures', FIXTURES, '--out', out, '--bootstrap-dir', STUB]);
  assert.equal(code, 0, stderr);
  const logic = JSON.parse(readFileSync(join(out, 'logic_l2.result.json'), 'utf8'));
  assert.equal(logic.status, 'DONE');
  assert.equal(logic.title, 'logic ready');
  assert.deepEqual(logic.state, { fired: true, answer: 42, untouched: null });
  assert.equal(logic.renders.length, 1);
  for (const verb of ['log', 'set_title', 'fetch', 'storage_set', 'storage_get', 'render', 'export_state']) {
    assert.ok(logic.trace.includes(verb), `trace misses ${verb}`);
  }
});

test('run --engine chromium drives the page through Playwright', async (t) => {
  let playwright = null;
  try {
    playwright = await import('playwright');
  } catch {
    if (process.env.JSR_REQUIRE_ENGINE === '1') {
      assert.fail('playwright is required (JSR_REQUIRE_ENGINE=1) but is not installed');
    }
    t.skip('playwright not installed: chromium engine test skipped');
    return;
  }
  const out = makeTmp();
  const { code, stderr } = await runCli(['run', '--engine', 'chromium', '--fixtures', FIXTURES, '--out', out, '--bootstrap-dir', STUB]);
  if (code !== 0) {
    if (process.env.JSR_REQUIRE_ENGINE === '1') assert.fail(`chromium run failed: ${stderr}`);
    t.skip(`chromium browser unavailable: ${stderr.split('\n')[0]}`);
    return;
  }
  const logic = JSON.parse(readFileSync(join(out, 'logic_l2.result.json'), 'utf8'));
  assert.equal(logic.status, 'DONE');
  assert.equal(logic.platform, 'web');
  assert.equal(logic.title, 'logic ready');
  assert.deepEqual(logic.state, { fired: true, answer: 42, untouched: null });
  assert.equal(logic.renders.length, 1);
  assert.equal(logic.dump.children[0].props.data, 'answer 42');
});
