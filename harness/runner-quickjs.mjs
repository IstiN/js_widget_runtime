// `run --engine quickjs`: the bare engine at $JSR_QJS_HARNESS
// (--iid/--preload/--script/--call/--out, lines `channel<TAB>payload`).
// The binary cannot run host timers, so this runner replays deterministically:
// each round reruns the whole item list from scratch (the host restarts, the
// trace of the LAST round is the result), appending one resolve/tick call per
// pending promise or timer, until a round adds nothing new (or call cap).
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootPaths } from './boot.mjs';
import { createHost, assembleResult } from './host.mjs';
import { HarnessError } from './fixtures.mjs';

export class EngineUnavailable extends HarnessError {}

const MAX_CALLS = 200;
const MAX_ROUNDS = 64;

export async function runWithQuickjs(fixture, bootOpts = {}) {
  const bin = process.env.JSR_QJS_HARNESS;
  if (!bin) throw new EngineUnavailable('run --engine quickjs needs $JSR_QJS_HARNESS (path of the qjs_harness binary)');
  const paths = bootPaths(fixture, bootOpts);
  const tmp = mkdtempSync(join(tmpdir(), 'jsr-qjs-'));
  const outPath = join(tmp, 'trace.tsv');
  try {
    return await replay(fixture, bin, paths, outPath);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function replay(fixture, bin, paths, outPath) {
  const calls = []; // structured: { id, kind, js }; one call per pending event
  const queued = new Set(); // tick ids already appended (rounds re-register timers)
  const queueAction = (action) => {
    if (action.type !== 'resolve') return; // interval/raf/cancel: bookkeeping lives in host.timers
    if (queued.has(action.id)) return;
    queued.add(action.id);
    calls.push({ id: action.id, kind: 'resolve', js: `__jsrResolve(${JSON.stringify(action.id)}, ${JSON.stringify(action.value) ?? 'undefined'})` });
  };
  const host = createHost({ fixtureDir: fixture.dir, mock: fixture.meta.mock ?? {}, fire: queueAction });
  let frame = 0;
  let error = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const callsBefore = calls.length;
    error = await replayRound(host, bin, buildArgs(fixture, paths, calls, outPath), outPath);
    if (error) break;
    if (calls.length >= MAX_CALLS) break;
    frame = queueDueTicks(host, calls, queued, frame);
    // converged when this round queued nothing new at all
    if (calls.length === callsBefore) break;
    host.restart(); // next round re-executes everything; keep the last round's view
  }
  return assembleResult({ fixture: fixture.id, platform: 'quickjs', host, error });
}

function buildArgs(fixture, paths, calls, outPath) {
  const args = ['--iid', fixture.id];
  // the inline engines define this in the __IID boot item (boot.mjs); the
  // binary needs it as an explicit first call (mockLookup never hits network)
  args.push('--call', 'var __JSR_MOCK_ORIGIN__ = "http://127.0.0.1:0";');
  if (paths.three) args.push('--preload', paths.three);
  args.push('--preload', paths.runtime, '--preload', paths.widget, '--script', paths.widgetJs);
  for (const c of calls) args.push('--call', c.js);
  args.push('--out', outPath);
  return args;
}

function runBinary(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${err.message}${stderr ? `\n${stderr.trim()}` : ''}`));
      else resolve(stdout);
    });
  });
}

async function replayRound(host, bin, args, outPath) {
  try {
    await runBinary(bin, args);
  } catch (e) {
    return `qjs_harness failed: ${e.message}`;
  }
  let text;
  try {
    text = readFileSync(outPath, 'utf8');
  } catch {
    return 'qjs_harness wrote no trace file';
  }
  feedTrace(host, text);
  return null;
}

function feedTrace(host, text) {
  for (const line of text.split('\n')) {
    const tab = line.indexOf('\t');
    if (line && tab > 0) host.handle(line.slice(0, tab), line.slice(tab + 1));
  }
}

function queueDueTicks(host, calls, queued, frame) {
  // ticks due now: still-registered timers, earliest delay first
  const due = [...host.timers.entries()]
    .map(([id, t]) => ({ id, ms: t.kind === 'raf' ? 0 : t.ms, raf: t.kind === 'raf' }))
    .sort((a, b) => a.ms - b.ms);
  let next = frame;
  for (const { id, raf } of due) {
    if (calls.length >= MAX_CALLS) break;
    if (queued.has(id)) continue;
    queued.add(id);
    calls.push(raf
      ? { id, kind: 'raf', js: `__jsrRaf(${JSON.stringify(id)}, ${++next * 16})` }
      : { id, kind: 'interval', js: `__jsrInterval(${JSON.stringify(id)})` });
  }
  return next;
}
