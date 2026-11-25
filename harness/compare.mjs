// Comparator — plan 1.3/1.4: children in order, props by key, numbers +-1,
// strings exact, colors exact, meta.json.ignore excluded, delta grammar
// `<type>[<selector>].<prop>[.<subprop>...]`.
const TOLERANCE = 1;

export function valuesEqual(expected, actual) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) <= TOLERANCE;
  }
  return expected === actual;
}

export function diffTree(expected, actual, ignore = new Set()) {
  const diffs = [];
  const counters = new Map();
  const visit = (e, a) => {
    const sel = counters.get(e.type) ?? 0;
    counters.set(e.type, sel + 1);
    const epath = `${e.type}[${sel}]`;
    if (!isNode(a)) {
      diffs.push({ path: epath, expected: 'node', actual: a === undefined ? 'missing' : a });
      return;
    }
    if (e.type !== a.type) {
      diffs.push({ path: epath, expected: e.type, actual: a.type });
      return;
    }
    walkProps(e.props ?? {}, a.props ?? {}, epath, ignore, diffs);
    const ec = e.children ?? [];
    const ac = (a.children ?? []);
    if (ec.length !== ac.length) diffs.push({ path: `${epath}.children`, expected: ec.length, actual: ac.length });
    for (let i = 0; i < Math.min(ec.length, ac.length); i++) visit(ec[i], ac[i]);
    const ee = e.events ?? {};
    const ae = a.events ?? {};
    for (const key of unionKeys(ee, ae)) {
      if (!valuesEqual(ee[key], ae[key])) {
        diffs.push({ path: `${epath}.events.${key}`, expected: ee[key] ?? 'missing', actual: ae[key] ?? 'missing' });
      }
    }
  };
  visit(expected, actual);
  return diffs;
}

function walkProps(expectedProps, actualProps, path, ignore, diffs) {
  for (const key of unionKeys(expectedProps, actualProps)) {
    if (ignore.has(key)) continue;
    walkValue(expectedProps[key], actualProps[key], `${path}.${key}`, diffs);
  }
}

function walkValue(expected, actual, path, diffs) {
  if (isPlainObject(expected) || isPlainObject(actual)) {
    const e = isPlainObject(expected) ? expected : {};
    const a = isPlainObject(actual) ? actual : {};
    for (const key of unionKeys(e, a)) walkValue(e[key], a[key], `${path}.${key}`, diffs);
    return;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    const e = Array.isArray(expected) ? expected : [];
    const a = Array.isArray(actual) ? actual : [];
    if (e.length !== a.length) diffs.push({ path, expected: e.length, actual: a.length });
    for (let i = 0; i < Math.min(e.length, a.length); i++) walkValue(e[i], a[i], `${path}[${i}]`, diffs);
    return;
  }
  if (!valuesEqual(expected, actual)) {
    diffs.push({ path, expected: expected === undefined ? 'missing' : expected, actual: actual === undefined ? 'missing' : actual });
  }
}

// finalDumpDelta: expected value at each delta path inside `tree`.
export function checkDelta(tree, deltaMap) {
  const diffs = [];
  for (const [path, expected] of Object.entries(deltaMap ?? {})) {
    const actual = resolveDeltaPath(tree, path);
    if (actual === undefined) diffs.push({ path, expected, actual: 'missing' });
    else if (!valuesEqual(actual, expected)) diffs.push({ path, expected, actual });
  }
  return diffs;
}

// `<type>[<selector>].<prop>[.<subprop>...]`; the selector is the zero-based
// occurrence of the type in depth-first order or a nodeId (`n3`). The first
// prop segment resolves through the node's `props` (the dump node shape),
// deeper segments traverse the resolved value.
export function resolveDeltaPath(tree, path) {
  const m = /^([A-Za-z0-9_]+)\[([A-Za-z0-9_]+)\]\.(.+)$/.exec(path);
  if (!m) return undefined;
  const node = findNode(tree, m[1], m[2]);
  if (!node) return undefined;
  let value = node;
  for (const seg of m[3].split('.')) {
    const arr = /^([A-Za-z0-9_]+)\[(\d+)\]$/.exec(seg);
    if (arr) {
      value = value?.[arr[1]]?.[Number(arr[2])];
    } else if (value && typeof value === 'object' && value.props && seg in value.props) {
      value = value.props[seg]; // dump-node shape: UI props live under props
    } else {
      value = value == null ? undefined : value[seg];
    }
  }
  return value;
}

function findNode(tree, type, selector) {
  let hit = null;
  let occurrence = 0;
  walk(tree, (node) => {
    if (node.type !== type) return;
    if (node.nodeId !== undefined && selector === node.nodeId) hit = node; // nodeId form wins
    if (hit === null && String(occurrence) === selector) hit = node;
    occurrence++;
  });
  return hit;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function unionKeys(a, b) {
  return [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])];
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNode(v) {
  return isPlainObject(v) && typeof v.type === 'string';
}

// `channels` compares case-insensitively with `_` removed; trace verbs are
// channel names without the `__jsr_` prefix.
export function normalizeVerb(name) {
  return String(name).replace(/^__jsr_/, '').toLowerCase().replaceAll('_', '');
}

export function deepSubset(expected, actual) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((v, i) => deepSubset(v, actual[i]));
  }
  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) return false;
    return Object.entries(expected).every(([k, v]) => k in actual && deepSubset(v, actual[k]));
  }
  return expected === actual;
}
