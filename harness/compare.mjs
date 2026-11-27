// Comparator — plan 1.3/1.4: children in order, props by key, sizes +-1 px,
// every other number exact, strings exact, colors exact, meta.json.ignore
// excluded, delta grammar `<type>[<selector>].<prop>[.<subprop>...]`.
// A3: the dump of a scrollable container must carry its scroll state
// (missing is not zero) and the delta grammar resolves `scrolledToEnd`.
import { isScrollableType } from './normalize.mjs';

const PX_TOLERANCE = 1;

// Prop keys that denote logical-pixel lengths: the only numbers compared
// with the +-1 px tolerance. Every other number compares exact — dump
// numbers are applied payload values (opacity 0.5, scale, flex, progress,
// durations, counts), not measurements, so exact is the strongest portable
// assertion. The leaf prop key decides (also inside decoration/style objects
// and array-valued sizes like `padding: [10, 20]`).
const PX_SIZE_PROPS = new Set([
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'size', 'fontSize', 'letterSpacing',
  'padding', 'margin', 'thickness',
  'spacing', 'runSpacing', 'mainAxisSpacing', 'crossAxisSpacing',
  'indent', 'endIndent', 'itemExtent', 'shrinkExtent',
  'radius', 'borderRadius', 'borderWidth', 'strokeWidth', 'centerSpaceRadius',
  'blur', 'sigma', 'elevation',
  'offsetX', 'offsetY', 'left', 'top', 'right', 'bottom', 'inset',
]);

export function valuesEqual(expected, actual, key) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (key !== undefined && PX_SIZE_PROPS.has(key)) {
      return Math.abs(expected - actual) <= PX_TOLERANCE;
    }
    return expected === actual;
  }
  return expected === actual;
}

// A3 scroll state: the dump of a scrollable container carries the primary
// -axis position and extents in logical px. `scrolledToEnd` is the universal
// at-end predicate (`offset >= max offset`), derived by the comparator from
// those numbers — a platform never dumps the boolean itself.
export const SCROLL_STATE_PROPS = ['scrollOffset', 'scrollExtent', 'viewportExtent'];

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
    checkScrollState(a, epath, diffs); // A3: missing scroll state is not zero; the ignore list never applies
    walkProps(e.props ?? {}, a.props ?? {}, epath, ignore, diffs);
    diffChildren(e, a, epath, visit, diffs);
    diffEvents(e, a, epath, diffs);
  };
  visit(expected, actual);
  return diffs;
}

// A3: every scrollable node of the actual dump carries its scroll state as
// finite non-negative numbers. A dump without them fails the fixture —
// a renderer that ignores `swipe` cannot pass by omitting the properties.
function checkScrollState(node, epath, diffs) {
  if (!isScrollableType(node.type)) return;
  for (const key of SCROLL_STATE_PROPS) {
    const v = node.props?.[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      diffs.push({ path: `${epath}.${key}`, expected: 'finite number >= 0 (A3 scroll state)', actual: v === undefined ? 'missing' : v });
    }
  }
}

function diffChildren(e, a, epath, visit, diffs) {
  const ec = e.children ?? [];
  const ac = (a.children ?? []);
  if (ec.length !== ac.length) diffs.push({ path: `${epath}.children`, expected: ec.length, actual: ac.length });
  for (let i = 0; i < Math.min(ec.length, ac.length); i++) visit(ec[i], ac[i]);
}

function diffEvents(e, a, epath, diffs) {
  const ee = e.events ?? {};
  const ae = a.events ?? {};
  for (const key of Object.keys(ee)) {
    if (!valuesEqual(ee[key], ae[key], key)) {
      diffs.push({ path: `${epath}.events.${key}`, expected: ee[key] ?? 'missing', actual: ae[key] ?? 'missing' });
    }
  }
}

// Props are compared by the keys of the expected tree: a platform may carry
// extra props (e.g. a textButton's live-text `data` next to `text`); props
// missing from the actual side are diffs, extra actual props are not.
function walkProps(expectedProps, actualProps, path, ignore, diffs) {
  for (const key of Object.keys(expectedProps)) {
    if (ignore.has(key)) continue;
    walkValue(expectedProps[key], actualProps?.[key], `${path}.${key}`, key, diffs);
  }
}

function walkValue(expected, actual, path, key, diffs) {
  if (isPlainObject(expected) || isPlainObject(actual)) return walkObjectValue(expected, actual, path, diffs);
  if (Array.isArray(expected) || Array.isArray(actual)) return walkArrayValue(expected, actual, path, key, diffs);
  if (!valuesEqual(expected, actual, key)) pushLeafDiff(expected, actual, path, diffs);
}

function walkObjectValue(expected, actual, path, diffs) {
  const e = isPlainObject(expected) ? expected : {};
  const a = isPlainObject(actual) ? actual : {};
  for (const key of Object.keys(e)) walkValue(e[key], a?.[key], `${path}.${key}`, key, diffs);
}

function walkArrayValue(expected, actual, path, key, diffs) {
  const e = Array.isArray(expected) ? expected : [];
  const a = Array.isArray(actual) ? actual : [];
  if (e.length !== a.length) diffs.push({ path, expected: e.length, actual: a.length });
  for (let i = 0; i < Math.min(e.length, a.length); i++) walkValue(e[i], a[i], `${path}[${i}]`, key, diffs);
}

function pushLeafDiff(expected, actual, path, diffs) {
  diffs.push({ path, expected: expected === undefined ? 'missing' : expected, actual: actual === undefined ? 'missing' : actual });
}

// finalDumpDelta: expected value at each delta path inside `tree`. The leaf
// prop segment of the path decides size-ness (`padding[0]` -> padding).
export function checkDelta(tree, deltaMap) {
  const diffs = [];
  for (const [path, expected] of Object.entries(deltaMap ?? {})) {
    const actual = resolveDeltaPath(tree, path);
    if (actual === undefined) diffs.push({ path, expected, actual: 'missing' });
    else if (!valuesEqual(actual, expected, leafKey(path))) diffs.push({ path, expected, actual });
  }
  return diffs;
}

function leafKey(path) {
  const m = /\.?([A-Za-z0-9_]+)(?:\[\d+\])?$/.exec(path);
  return m ? m[1] : undefined;
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
  for (const seg of m[3].split('.')) value = resolveSegment(value, seg);
  return value;
}

// The UI props of a dump node live under `props`; everything else traverses
// the plain value (normalized tree shape).
function propBase(value, key) {
  if (value && typeof value === 'object' && value.props && key in value.props) return value.props[key];
  return value?.[key];
}

function resolveSegment(value, seg) {
  const arr = /^([A-Za-z0-9_]+)\[(\d+)\]$/.exec(seg);
  if (arr) return propBase(value, arr[1])?.[Number(arr[2])];
  const virtual = virtualProp(value, seg);
  if (virtual !== undefined) return virtual;
  return propBase(value, seg);
}

// A3: `scrolledToEnd` derives from the dumped scroll state (offset >= max
// offset). Unknown when the state is missing — the well-formedness check
// reports that separately, the delta then reads `missing`, not `false`.
function virtualProp(node, key) {
  if (key !== 'scrolledToEnd' || !isScrollableType(node?.type)) return undefined;
  const { scrollOffset, scrollExtent, viewportExtent } = node.props ?? {};
  if ([scrollOffset, scrollExtent, viewportExtent].some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    return undefined;
  }
  return scrollOffset >= scrollExtent - viewportExtent;
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
