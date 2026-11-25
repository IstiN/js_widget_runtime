import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { runCli, makeTmp, copyFixtures, FIXTURES, STUB, HARNESS, REPO_ROOT } from './helpers.mjs';

test('--help exits 0 and prints usage', async () => {
  const { code, stdout } = await runCli(['--help']);
  assert.equal(code, 0);
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /jsr-harness compare/);
});

test('usage errors exit 1', async () => {
  assert.equal((await runCli([])).code, 1);
  assert.match((await runCli(['nope'])).stderr, /unknown command/);
  assert.equal((await runCli(['compare', '--fixtures', FIXTURES])).code, 1); // missing --results
  assert.equal((await runCli(['compare', '--fixtures', FIXTURES, '--results', FIXTURES, '--out-report', '/tmp/r.md', '--bogus', 'x'])).code, 1);
  assert.match((await runCli(['run', '--engine', 'wasm', '--fixtures', FIXTURES, '--out', makeTmp()])).stderr, /--engine must be/);
  assert.equal((await runCli(['run', '--engine', 'node', '--fixtures', FIXTURES, '--out', makeTmp(), '--settle', 'abc'])).code, 1);
});

test('compare passes the android-shaped sample and writes report + badge', async () => {
  const tmp = makeTmp();
  const report = join(tmp, 'report.md');
  const badge = join(tmp, 'badge.json');
  const { code, stdout } = await runCli(['compare', '--fixtures', FIXTURES, '--results', FIXTURES, '--out-report', report, '--out-badge', badge]);
  assert.equal(code, 0);
  assert.match(stdout, /Score: 100% \(passed 1, failed 0, skipped 0\)/);
  const md = readFileSync(report, 'utf8');
  assert.match(md, /\| taps \| L1 \| PASS \| - \|/);
  const parsed = JSON.parse(readFileSync(badge, 'utf8'));
  assert.deepEqual(parsed, {
    platform: 'android', score: 100, passed: 1, failed: 0, skipped: 0,
    generatedAt: parsed.generatedAt,
  });
  assert.match(parsed.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('compare exits 2 on a failing fixture', async () => {
  const tmp = makeTmp();
  const results = join(tmp, 'results');
  mkdirSync(results);
  const broken = JSON.parse(readFileSync(join(FIXTURES, 'taps.android.result.json'), 'utf8'));
  broken.dump.children[0].props.data = 'Wrong';
  writeFileSync(join(results, 'taps.android.result.json'), JSON.stringify(broken));
  const { code } = await runCli(['compare', '--fixtures', FIXTURES, '--results', results, '--out-report', join(tmp, 'r.md')]);
  assert.equal(code, 2);
  const md = readFileSync(join(tmp, 'r.md'), 'utf8');
  assert.match(md, /\| taps \| L1 \| FAIL \|/);
  assert.match(md, /Score: 0%/);
});

test('compare treats SKIP as skipped and exits 0', async () => {
  const tmp = makeTmp();
  const results = join(tmp, 'results');
  mkdirSync(results);
  writeFileSync(join(results, 'taps.android.result.json'), JSON.stringify({
    fixture: 'taps', platform: 'android', status: 'SKIP', skippedReason: 'no device',
  }));
  const { code } = await runCli(['compare', '--fixtures', FIXTURES, '--results', results, '--out-report', join(tmp, 'r.md')]);
  assert.equal(code, 0);
  assert.match(readFileSync(join(tmp, 'r.md'), 'utf8'), /\| taps \| L1 \| SKIP \|/);
});

test('compare invalid inputs exit 1 naming the path', async () => {
  const tmp = makeTmp();
  const results = join(tmp, 'results');
  mkdirSync(results);
  writeFileSync(join(results, 'bad.result.json'), 'not json');
  const bad = await runCli(['compare', '--fixtures', FIXTURES, '--results', results, '--out-report', join(tmp, 'r.md')]);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /bad\.result\.json/);

  writeFileSync(join(results, 'bad.result.json'), JSON.stringify({ fixture: 'missing_one', platform: 'android', status: 'DONE' }));
  const unknown = await runCli(['compare', '--fixtures', FIXTURES, '--results', results, '--out-report', join(tmp, 'r.md')]);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /missing_one\/meta\.json/);

  writeFileSync(join(results, 'bad.result.json'), JSON.stringify({ fixture: 'taps', platform: 'android', status: 'PASS' }));
  const status = await runCli(['compare', '--fixtures', FIXTURES, '--results', results, '--out-report', join(tmp, 'r.md')]);
  assert.equal(status.code, 1);
  assert.match(status.stderr, /"status" must be "DONE" or "SKIP"/);
});

test('coverage prints totals and exits 0 when complete', async () => {
  const tmp = makeTmp();
  const inventory = join(tmp, 'inventory.json');
  writeFileSync(inventory, JSON.stringify({
    nodes: [
      { type: 'column', events: [], props: ['spacing'] },
      { type: 'text', events: [], props: ['data'] },
      { type: 'textButton', events: ['onTap'], props: ['text'] },
    ],
  }));
  const { code, stdout } = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', inventory]);
  assert.equal(code, 0);
  assert.match(stdout, /nodes: 3\/3 covered/);
  assert.match(stdout, /props: 3\/3 covered/);
  assert.match(stdout, /event keys: 1\/1 covered/);
  assert.match(stdout, /fixtures L1: 1/);
  assert.match(stdout, /fixtures L2: 2/);
  assert.match(stdout, /fixtures 3D-API: 1/);
});

test('coverage exits 2 on node and event gaps', async () => {
  const tmp = makeTmp();
  const gapNode = join(tmp, 'gap-node.json');
  writeFileSync(gapNode, JSON.stringify({ nodes: [{ type: 'image', events: [] }] }));
  const nodeGap = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', gapNode]);
  assert.equal(nodeGap.code, 2);
  assert.match(nodeGap.stderr, /missing node fixtures: image/);

  const gapEvent = join(tmp, 'gap-event.json');
  writeFileSync(gapEvent, JSON.stringify({ nodes: [{ type: 'column', events: ['onLongPress'] }] }));
  const eventGap = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', gapEvent]);
  assert.equal(eventGap.code, 2);
  assert.match(eventGap.stderr, /missing event fixtures: onLongPress/);
});

test('coverage accepts the inventory path as a directory (../inventory.json)', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'jsr-inv-'));
  const inventory = { nodes: [{ type: 'text', events: [] }] };
  writeFileSync(join(tmp, 'inventory.json'), JSON.stringify(inventory));
  mkdirSync(join(tmp, 'nodes'));
  const { code } = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', join(tmp, 'nodes')]);
  assert.equal(code, 0);
});

test('run --engine node drives mock fetch, storage, timers and exportState', async () => {
  const out = makeTmp();
  const { code, stdout } = await runCli(['run', '--engine', 'node', '--fixtures', FIXTURES, '--out', out, '--bootstrap-dir', STUB]);
  assert.equal(code, 0);
  assert.match(stdout, /ran 3 fixture\(s\), skipped 2/); // taps has actions; delta_probe pins a renderer value
  const logic = JSON.parse(readFileSync(join(out, 'logic_l2.result.json'), 'utf8'));
  assert.equal(logic.status, 'DONE');
  assert.equal(logic.platform, 'node');
  assert.equal(logic.title, 'logic ready');
  assert.deepEqual(logic.state, { fired: true, answer: 42, untouched: null });
  for (const verb of ['log', 'set_title', 'fetch', 'storage_set', 'storage_get', 'render', 'export_state']) {
    assert.ok(logic.trace.includes(verb), `trace misses ${verb}`);
  }
  assert.equal(logic.renders.length, 1);
  assert.equal(logic.dump.props.spacing, 8);
  assert.equal(logic.dump.nodeId, 'n0');
  assert.equal(logic.dump.children[0].props.data, 'answer 42');
  assert.deepEqual(logic.finalDump, logic.dump);
  const taps = JSON.parse(readFileSync(join(out, 'taps.result.json'), 'utf8'));
  assert.equal(taps.status, 'SKIP');
  assert.match(taps.skippedReason, /actions require a rendering runner/);
  const math = JSON.parse(readFileSync(join(out, 'math_3d.result.json'), 'utf8'));
  assert.deepEqual(math.state, { dot: 28, transformed: { x: 2, y: 4, z: 6 } });
});

test('run --filter selects fixtures by glob', async () => {
  const out = makeTmp();
  const { code } = await runCli(['run', '--engine', 'node', '--fixtures', FIXTURES, '--out', out, '--bootstrap-dir', STUB, '--filter', 'logic_*']);
  assert.equal(code, 0);
  assert.equal(existsSync(join(out, 'taps.result.json')), false);
  assert.ok(readFileSync(join(out, 'logic_l2.result.json'), 'utf8').length > 0);
});

test('--write-expect seeds expect.state for 3D-API fixtures only', async () => {
  const fixturesCopy = copyFixtures();
  const out = makeTmp();
  const { code } = await runCli(['run', '--engine', 'node', '--fixtures', fixturesCopy, '--out', out, '--bootstrap-dir', STUB, '--write-expect', '--filter', 'math_*']);
  assert.equal(code, 0);
  const expected = JSON.parse(readFileSync(join(fixturesCopy, 'math_3d', 'expected.json'), 'utf8'));
  assert.deepEqual(expected.expect.state, { dot: 28, transformed: { x: 2, y: 4, z: 6 } });

  const refused = await runCli(['run', '--engine', 'node', '--fixtures', fixturesCopy, '--out', makeTmp(), '--bootstrap-dir', STUB, '--write-expect', '--filter', 'logic_*']);
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /fixture logic_l2: --write-expect/);
  assert.match(refused.stderr, /3D-API/);
});

test('run --engine quickjs without $JSR_QJS_HARNESS exits 1', async () => {
  const { code, stderr } = await runCli(['run', '--engine', 'quickjs', '--fixtures', FIXTURES, '--out', makeTmp(), '--bootstrap-dir', STUB], { JSR_QJS_HARNESS: '' });
  assert.equal(code, 1);
  assert.match(stderr, /JSR_QJS_HARNESS/);
});

test('invalid settle, filter and fixture values exit 1', async () => {
  assert.equal((await runCli(['run', '--engine', 'node', '--fixtures', join(FIXTURES, 'taps'), '--out', makeTmp()])).code, 1);
  assert.equal((await runCli(['run', '--engine', 'node', '--fixtures', FIXTURES, '--out', makeTmp(), '--bootstrap-dir', STUB, '--filter', 'zzz_*'])).code, 1);
});

test('inventory loading errors exit 1 naming the path', async () => {
  const tmp = makeTmp();
  const missing = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', join(tmp, 'nope.json')]);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /inventory path not readable/);

  const broken = join(tmp, 'broken.json');
  writeFileSync(broken, '{nope');
  const invalid = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', broken]);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /invalid inventory JSON/);

  const badShape = join(tmp, 'shape.json');
  writeFileSync(badShape, JSON.stringify({ nodes: 'nope' }));
  const shape = await runCli(['coverage', '--fixtures', FIXTURES, '--inventory', badShape]);
  assert.equal(shape.code, 1);
  assert.match(shape.stderr, /inventory must hold nodes\[\]/);
});

test('mock serves meta.json.mock until SIGTERM', async () => {
  const child = execFile(process.execPath, [HARNESS, 'mock', join(FIXTURES, 'logic_l2')], { cwd: REPO_ROOT }, () => {});
  try {
    const origin = await new Promise((resolve, reject) => {
      child.stdout.once('data', (d) => {
        const line = String(d).split('\n').find((l) => l.startsWith('http://'));
        if (line) resolve(line); else reject(new Error(`no origin line in ${d}`));
      });
      setTimeout(() => reject(new Error('mock server printed no origin')), 5000);
    });
    const res = await fetch(`${origin}/data`);
    assert.deepEqual(await res.json(), { answer: 42 });
    const exit = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
    child.kill('SIGTERM');
    assert.equal(await exit, 0);
  } finally {
    if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
  }
});

test('fixtures with renderer-side finalDumpDelta are skipped headless', async () => {
  const out = makeTmp();
  const { code, stdout } = await runCli(['run', '--engine', 'node', '--fixtures', FIXTURES, '--out', out, '--bootstrap-dir', STUB, '--filter', 'delta_probe']);
  assert.equal(code, 0);
  const probe = JSON.parse(readFileSync(join(out, 'delta_probe.result.json'), 'utf8'));
  assert.equal(probe.status, 'SKIP');
  assert.match(probe.skippedReason, /finalDumpDelta/);
});
