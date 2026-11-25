// `run --engine quickjs`: the bare engine at $JSR_QJS_HARNESS
// (--iid/--preload/--script/--call/--out, lines `channel<TAB>payload`).
// The binary cannot run host timers, so this runner replays deterministically:
// each round reruns the whole item list from scratch, appends tick calls for
// timers still pending, and stops when a round adds nothing (or call cap).
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
    const host = createHost({ fixtureDir: fixture.dir, mock: fixture.meta.mock ?? {}, fire: queueAction });
    const calls = []; // structured: { id, kind, js }
    let frame = 0;
    let error = null;

    function queueAction(action) {
      if (action.type === 'resolve') {
        calls.push({ id: null, kind: 'resolve', js: `__jsrResolve(${JSON.stringify(action.id)}, ${JSON.stringify(action.value) ?? 'undefined'})` });
      }
      // interval/raf/cancel: bookkeeping lives in host.timers
    }

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const executed = [...calls];
      const callsBefore = calls.length;
      const args = ['--iid', fixture.id];
      if (paths.three) args.push('--preload', paths.three);
      args.push('--preload', paths.runtime, '--preload', paths.widget, '--script', paths.widgetJs);
      for (const c of calls) args.push('--call', c.js);
      args.push('--out', outPath);

      let output;
      try {
        output = await new Promise((resolve, reject) => {
          execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) reject(new Error(`${err.message}${stderr ? `\n${stderr.trim()}` : ''}`));
            else resolve(stdout);
          });
        });
      } catch (e) {
        error = `qjs_harness failed: ${e.message}`;
        break;
      }
      void output; // the trace comes from the --out file
      let text = '';
      try {
        text = readFileSync(outPath, 'utf8');
      } catch {
        error = 'qjs_harness wrote no trace file';
        break;
      }
      for (const line of text.split('\n')) {
        if (!line) continue;
        const tab = line.indexOf('\t');
        if (tab <= 0) continue;
        host.handle(line.slice(0, tab), line.slice(tab + 1));
      }
      // ticks appended through this round have now executed in the replay
      for (const c of executed) {
        if (c.kind !== 'resolve') host.markFired(c.id);
      }
      if (calls.length >= MAX_CALLS) break;
      // ticks due now: still-registered timers, earliest delay first
      const due = [...host.timers.entries()]
        .map(([id, t]) => ({ id, ms: t.kind === 'raf' ? 0 : t.ms, raf: t.kind === 'raf' }))
        .sort((a, b) => a.ms - b.ms);
      for (const { id, raf } of due) {
        if (calls.length >= MAX_CALLS) break;
        calls.push(raf
          ? { id, kind: 'raf', js: `__jsrRaf(${JSON.stringify(id)}, ${++frame * 16})` }
          : { id, kind: 'interval', js: `__jsrInterval(${JSON.stringify(id)})` });
      }
      // converged only when this round queued nothing new at all
      if (calls.length === callsBefore) break;
    }
    return assembleResult({ fixture: fixture.id, platform: 'quickjs', host, error });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
