// Expectation evaluation for `compare` — plan 1.4 expected fields against a
// result. The expected AUI is derived from the widget's own renders. One
// helper per expected field keeps every function small (CRAP gate <= 8).
import { normalizeTree } from './normalize.mjs';
import { diffTree, checkDelta, normalizeVerb, deepSubset } from './compare.mjs';

export function evaluateResult(fixture, result) {
  const expect = fixture.expected.expect;
  const ignore = new Set(fixture.meta.ignore ?? []);
  const { initial, final, parseDiffs } = parseRenderTrees(result);
  return [
    ...errorDiffs(result),
    ...rendersDiffs(expect, result),
    ...parseDiffs,
    ...dumpDiffs(expect, result, ignore, initial, final),
    ...deltaDiffs(expect, result, final),
    ...traceDiffs(expect, result),
    ...channelsDiffs(expect, result),
    ...titleDiffs(expect, result),
    ...stateDiffs(expect, result),
    ...consoleDiffs(expect, result),
  ];
}

function parseRenderTrees(result) {
  const renders = result.renders ?? [];
  if (renders.length === 0) return { initial: null, final: null, parseDiffs: [] };
  try {
    const initial = normalizeTree(JSON.parse(renders[0]));
    const final = normalizeTree(JSON.parse(renders[renders.length - 1]));
    return { initial, final, parseDiffs: [] };
  } catch (e) {
    return { initial: null, final: null, parseDiffs: [{ path: 'renders[0]', expected: 'render payload JSON', actual: e.message }] };
  }
}

function errorDiffs(result) {
  if (!result.error) return [];
  return [{ path: 'error', expected: 'clean run', actual: result.error }];
}

function rendersDiffs(expect, result) {
  const renders = result.renders ?? [];
  if (expect.renders !== undefined && renders.length !== expect.renders) {
    return [{ path: 'renders', expected: expect.renders, actual: renders.length }];
  }
  return [];
}

function dumpDiffs(expect, result, ignore, initial, final) {
  const diffs = [];
  if (!initial) return diffs;
  const renders = result.renders ?? [];
  if (result.dump == null) diffs.push({ path: 'dump', expected: 'AUI dump', actual: 'missing' });
  else diffs.push(...diffTree(initial, result.dump, ignore));
  if (result.finalDump == null) {
    if (renders.length > 1) diffs.push({ path: 'finalDump', expected: 'AUI dump', actual: 'missing' });
  } else {
    diffs.push(...diffTree(final, result.finalDump, ignore));
  }
  return diffs;
}

function deltaDiffs(expect, result, final) {
  if (!expect.finalDumpDelta) return [];
  const target = result.finalDump ?? final;
  if (target) return checkDelta(target, expect.finalDumpDelta);
  return [{ path: 'finalDumpDelta', expected: Object.keys(expect.finalDumpDelta).join(','), actual: 'no dump' }];
}

function traceDiffs(expect, result) {
  if (!expect.trace) return [];
  const actualVerbs = (result.trace ?? []).map(normalizeVerb);
  const wanted = expect.trace.map(normalizeVerb);
  const same = actualVerbs.length === wanted.length && wanted.every((v, i) => actualVerbs[i] === v);
  if (!same) return [{ path: 'trace', expected: expect.trace.join(' '), actual: (result.trace ?? []).join(' ') }];
  return [];
}

function channelsDiffs(expect, result) {
  if (!expect.channels) return [];
  const diffs = [];
  const present = new Set((result.trace ?? []).map(normalizeVerb));
  for (const channel of expect.channels) {
    if (!present.has(normalizeVerb(channel))) {
      diffs.push({ path: `channels.${channel}`, expected: 'occurs', actual: 'missing' });
    }
  }
  return diffs;
}

function titleDiffs(expect, result) {
  if (expect.title !== undefined && result.title !== expect.title) {
    return [{ path: 'title', expected: expect.title, actual: result.title ?? null }];
  }
  return [];
}

function stateDiffs(expect, result) {
  if (expect.state !== undefined && !deepSubset(expect.state, result.state ?? {})) {
    return [{ path: 'state', expected: `subset of ${JSON.stringify(expect.state)}`, actual: JSON.stringify(result.state ?? null) }];
  }
  return [];
}

function consoleDiffs(expect, result) {
  if (!expect.console) return [];
  const diffs = [];
  const joined = (result.console ?? []).join('\n');
  for (const needle of expect.console) {
    if (!joined.includes(needle)) diffs.push({ path: `console[${needle}]`, expected: 'substring', actual: 'missing' });
  }
  return diffs;
}
