// Expectation evaluation for `compare` — plan 1.4 expected fields against a
// result. The expected AUI is derived from the widget's own renders.
import { normalizeTree } from './normalize.mjs';
import { diffTree, checkDelta, normalizeVerb, deepSubset } from './compare.mjs';

export function evaluateResult(fixture, result) {
  const diffs = [];
  const expect = fixture.expected.expect;
  const ignore = new Set(fixture.meta.ignore ?? []);

  if (result.error) diffs.push({ path: 'error', expected: 'clean run', actual: result.error });

  const renders = result.renders ?? [];
  if (expect.renders !== undefined && renders.length !== expect.renders) {
    diffs.push({ path: 'renders', expected: expect.renders, actual: renders.length });
  }

  let initial = null;
  let final = null;
  if (renders.length > 0) {
    try {
      initial = normalizeTree(JSON.parse(renders[0]));
      final = normalizeTree(JSON.parse(renders[renders.length - 1]));
    } catch (e) {
      diffs.push({ path: 'renders[0]', expected: 'render payload JSON', actual: e.message });
    }
  }
  if (initial) {
    if (result.dump == null) diffs.push({ path: 'dump', expected: 'AUI dump', actual: 'missing' });
    else diffs.push(...diffTree(initial, result.dump, ignore));
    if (result.finalDump == null) {
      if (renders.length > 1) diffs.push({ path: 'finalDump', expected: 'AUI dump', actual: 'missing' });
    } else {
      diffs.push(...diffTree(final, result.finalDump, ignore));
    }
  }

  if (expect.finalDumpDelta) {
    const target = result.finalDump ?? final;
    if (target) diffs.push(...checkDelta(target, expect.finalDumpDelta));
    else diffs.push({ path: 'finalDumpDelta', expected: Object.keys(expect.finalDumpDelta).join(','), actual: 'no dump' });
  }

  if (expect.trace) {
    const actualVerbs = (result.trace ?? []).map(normalizeVerb);
    const wanted = expect.trace.map(normalizeVerb);
    const same = actualVerbs.length === wanted.length && wanted.every((v, i) => actualVerbs[i] === v);
    if (!same) diffs.push({ path: 'trace', expected: expect.trace.join(' '), actual: (result.trace ?? []).join(' ') });
  }

  if (expect.channels) {
    const present = new Set((result.trace ?? []).map(normalizeVerb));
    for (const channel of expect.channels) {
      if (!present.has(normalizeVerb(channel))) {
        diffs.push({ path: `channels.${channel}`, expected: 'occurs', actual: 'missing' });
      }
    }
  }

  if (expect.title !== undefined && result.title !== expect.title) {
    diffs.push({ path: 'title', expected: expect.title, actual: result.title ?? null });
  }

  if (expect.state !== undefined && !deepSubset(expect.state, result.state ?? {})) {
    diffs.push({ path: 'state', expected: `subset of ${JSON.stringify(expect.state)}`, actual: JSON.stringify(result.state ?? null) });
  }

  if (expect.console) {
    const joined = (result.console ?? []).join('\n');
    for (const needle of expect.console) {
      if (!joined.includes(needle)) diffs.push({ path: `console[${needle}]`, expected: 'substring', actual: 'missing' });
    }
  }

  return diffs;
}
