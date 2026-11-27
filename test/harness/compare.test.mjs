import test from 'node:test';
import assert from 'node:assert/strict';
import { diffTree, checkDelta, resolveDeltaPath, normalizeVerb, deepSubset, valuesEqual } from '../../harness/compare.mjs';
import { normalizeTree } from '../../harness/normalize.mjs';

function sample() {
  return normalizeTree({
    type: 'column',
    spacing: 12,
    children: [
      { type: 'text', data: 'A' },
      { type: 'text', data: 'B', style: { fontSize: 20, color: '#aabbcc' } },
    ],
  });
}

test('identical trees produce no diffs', () => {
  assert.deepEqual(diffTree(sample(), sample()), []);
});

function rawTree(spacing, overrides = {}) {
  return normalizeTree({
    type: 'column',
    spacing,
    children: [
      { type: 'text', data: overrides.a ?? 'A' },
      { type: 'text', data: overrides.b ?? 'B', fontSize: overrides.fontSize ?? 20, color: overrides.color ?? '#aabbcc' },
    ],
  });
}

test('sizes compare with tolerance +-1, other numbers exact, strings and colors exact', () => {
  const expected = rawTree(12);
  assert.deepEqual(diffTree(expected, rawTree(13)), []); // spacing: px size, +-1 ok
  const diffs = diffTree(expected, rawTree(14));
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].path, 'column[0].spacing');
  assert.ok(diffTree(expected, rawTree(12, { color: '#AABBCD' })).some((d) => d.path.endsWith('.color')));
  assert.ok(diffTree(expected, rawTree(12, { a: 'X' })).some((d) => d.path === 'text[0].data'));
});

test('scoped tolerance: unit-interval numbers are unasserted no more', () => {
  const tree = (opacity) => normalizeTree({ type: 'column', opacity, children: [{ type: 'text', data: 'A' }] });
  const expected = tree(0.5);
  assert.deepEqual(diffTree(expected, tree(0.5)), []);
  for (const actual of [0, 1, -3, 1.5]) {
    const diffs = diffTree(expected, tree(actual));
    assert.equal(diffs.length, 1, `opacity 0.5 vs ${actual} must fail`);
    assert.equal(diffs[0].path, 'column[0].opacity');
    assert.equal(diffs[0].expected, 0.5);
    assert.equal(diffs[0].actual, actual);
  }
  // px sizes keep their tolerance: 100 vs 100.9 passes, 100 vs 101.1 fails
  const sized = (height) => normalizeTree({ type: 'container', height, children: [] });
  assert.deepEqual(diffTree(sized(100), sized(100.9)), []);
  assert.equal(diffTree(sized(100), sized(101.1)).length, 1);
});

test('children are compared in order', () => {
  const expected = sample();
  const swapped = normalizeTree({
    type: 'column', spacing: 12,
    children: [expected.children[1], expected.children[0]],
  });
  const diffs = diffTree(expected, swapped);
  assert.ok(diffs.some((d) => d.path === 'text[0].data'));
});

test('ignore list excludes props at any depth', () => {
  const expected = sample();
  const differing = rawTree(12, { a: 'X' }); // text[0].data differs
  assert.ok(diffTree(expected, differing).length > 0);
  assert.deepEqual(diffTree(expected, differing, new Set(['data'])), []);
  assert.deepEqual(diffTree(expected, rawTree(12), new Set(['spacing'])), []);
});

test('props missing from the actual side are diffs; extra actual props are tolerated', () => {
  const expected = sample();
  const withoutSpacing = normalizeTree({ type: 'column', children: expected.children });
  assert.ok(diffTree(expected, withoutSpacing).some((d) => d.path === 'column[0].spacing' && d.actual === 'missing'));
  const withExtra = sample();
  withExtra.children[0].props.extra = 1;
  assert.deepEqual(diffTree(expected, withExtra), []); // expected-driven: platform extras are fine
  const fewer = normalizeTree({ type: 'column', spacing: 12, children: [expected.children[0]] });
  const diffs = diffTree(expected, fewer);
  assert.ok(diffs.some((d) => d.path === 'column[0].children' && d.expected === 2 && d.actual === 1));
});

test('a textButton dump with live-text data matches the aliased expected tree', () => {
  // raw widget payload: textButton carries text only -> alias moves it to data
  const expected = normalizeTree({ type: 'column', children: [{ type: 'textButton', text: 'Tap me', onTap: 'tap' }] });
  assert.deepEqual(expected.children[0].props, { data: 'Tap me' });
  // the reference dump carries both (live text), expected-driven compare passes
  const dump = normalizeTree({ type: 'column', children: [{ type: 'textButton', text: 'Tap me', data: 'Tap me', onTap: 'tap' }] });
  assert.deepEqual(dump.children[0].props, { text: 'Tap me', data: 'Tap me' }); // idempotent: both kept
  assert.deepEqual(diffTree(expected, dump), []);
});

test('delta paths resolve through first-level array props', () => {
  const tree = normalizeTree({ type: 'text', data: 'X', textShadows: [{ blur: 4, color: '#000000' }, { blur: 2 }], decoration: { shadows: [{ blur: 7 }] } });
  assert.equal(resolveDeltaPath(tree, 'text[0].textShadows[0].blur'), 4);
  assert.equal(resolveDeltaPath(tree, 'text[0].textShadows[1].blur'), 2);
  assert.equal(resolveDeltaPath(tree, 'text[n0].textShadows[0].color'), '#000000');
  assert.equal(resolveDeltaPath(tree, 'text[0].decoration.shadows[0].blur'), 7);
  assert.equal(checkDelta(tree, { 'text[0].textShadows[0].blur': 4 })[0], undefined);
});

test('delta grammar resolves both selector kinds', () => {
  const tree = sample(); // nodes: n0 column, n1 text 'A', n2 text 'B'
  assert.equal(resolveDeltaPath(tree, 'text[0].data'), 'A');
  assert.equal(resolveDeltaPath(tree, 'text[1].data'), 'B');
  assert.equal(resolveDeltaPath(tree, 'text[n2].data'), 'B');
  assert.equal(resolveDeltaPath(tree, 'text[n1].fontSize'), undefined);
  assert.equal(resolveDeltaPath(tree, 'text[n2].fontSize'), 20);
  assert.equal(resolveDeltaPath(tree, 'column[0].children[0].type'), 'text');
  assert.equal(resolveDeltaPath(tree, 'text[5].data'), undefined);
});

test('checkDelta reports missing paths and applies the scoped tolerance', () => {
  const tree = sample();
  assert.deepEqual(checkDelta(tree, { 'text[0].data': 'A', 'text[1].fontSize': 21 }), []); // fontSize: px size
  assert.equal(checkDelta(tree, { 'text[0].data': 'X' }).length, 1);
  assert.equal(checkDelta(tree, { 'text[9].data': 'A' })[0].actual, 'missing');
  assert.equal(checkDelta(tree, { 'text[1].fontSize': 22 })[0].actual, 20);
  assert.equal(checkDelta(tree, { 'text[1].fontSize': 20.9 })[0], undefined);
});

test('verbs normalize case-insensitively with underscores removed', () => {
  assert.equal(normalizeVerb('__jsr_set_title'), 'settitle');
  assert.equal(normalizeVerb('setTitle'), 'settitle');
  assert.equal(normalizeVerb('render'), 'render');
});

test('deepSubset checks nested objects, exact arrays and scalars', () => {
  assert.equal(deepSubset({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2], d: 3 }, x: 0 }), true);
  assert.equal(deepSubset({ b: { c: [1] } }, { b: { c: [1, 2] } }), false);
  assert.equal(deepSubset({ a: 1 }, { a: 2 }), false);
});

test('valuesEqual: +-1 only for px-size keys, exact otherwise, strict everything else', () => {
  assert.equal(valuesEqual(10, 9), false); // no key: exact
  assert.equal(valuesEqual(10, 10), true);
  assert.equal(valuesEqual(100, 100.9, 'width'), true); // px size key
  assert.equal(valuesEqual(100, 101.1, 'width'), false);
  assert.equal(valuesEqual(0.5, 1.5, 'opacity'), false); // non-size key: exact
  assert.equal(valuesEqual(100, 100.9, 'radius'), true); // nested leaf key of a decoration path
  assert.equal(valuesEqual('#AA', '#AA'), true);
  assert.equal(valuesEqual(0, false), false);
  assert.equal(valuesEqual(null, undefined), false);
});

test('A3: a scrollable dump without scroll state fails, and ignore never exempts it', () => {
  const scrollState = { scrollOffset: 0, scrollExtent: 2000, viewportExtent: 400 };
  const expected = normalizeTree({ type: 'column', children: [{ type: 'scroll', children: [] }] });
  const good = normalizeTree({ type: 'column', children: [{ type: 'scroll', ...scrollState, children: [] }] });
  assert.deepEqual(diffTree(expected, good), []);
  const bad = normalizeTree({ type: 'column', children: [{ type: 'scroll', children: [] }] });
  const diffs = diffTree(expected, bad);
  assert.deepEqual(diffs.map((d) => d.path), ['scroll[0].scrollOffset', 'scroll[0].scrollExtent', 'scroll[0].viewportExtent']);
  assert.ok(diffs.every((d) => d.actual === 'missing'));
  // negative or non-numeric scroll state is a failure too
  const negative = normalizeTree({ type: 'scroll', scrollOffset: -1, scrollExtent: 2000, viewportExtent: 400, children: [] });
  assert.equal(diffTree(negative, negative).length, 1);
  // the ignore list must not be able to hide a missing scroll state
  assert.deepEqual(diffTree(expected, bad, new Set(['scrollOffset'])), diffs);
});

test('A3: scrolledToEnd derives from the dumped scroll state', () => {
  const scroll = (offset, extent, viewport) =>
    normalizeTree({ type: 'scroll', scrollOffset: offset, scrollExtent: extent, viewportExtent: viewport, children: [] });
  // 0 + 2000 - 400 = 1600: offset 1600 is at end, 1599 is not
  assert.equal(resolveDeltaPath(scroll(1600, 2000, 400), 'scroll[n0].scrolledToEnd'), true);
  assert.equal(resolveDeltaPath(scroll(1599, 2000, 400), 'scroll[n0].scrolledToEnd'), false);
  assert.equal(resolveDeltaPath(scroll(0, 300, 400), 'scroll[n0].scrolledToEnd'), true); // content fits
  assert.deepEqual(checkDelta(scroll(1700, 2000, 400), { 'scroll[n0].scrolledToEnd': true }), []);
  assert.equal(checkDelta(scroll(10, 2000, 400), { 'scroll[n0].scrolledToEnd': true })[0].actual, false);
  // missing state reads `missing`, not `false`
  const bare = normalizeTree({ type: 'scroll', children: [] });
  assert.equal(checkDelta(bare, { 'scroll[n0].scrolledToEnd': true })[0].actual, 'missing');
  // the alias resolves: ScrollView dumps to scroll and carries the same virtual prop
  const aliased = normalizeTree({ type: 'ScrollView', scrollOffset: 1600, scrollExtent: 2000, viewportExtent: 400, children: [] });
  assert.equal(aliased.type, 'scroll');
  assert.equal(resolveDeltaPath(aliased, 'scroll[n0].scrolledToEnd'), true);
});

test('nested object props diff key by key; array props diff by length and items', () => {
  const expected = normalizeTree({ type: 'container', decoration: { color: '#112233', radius: 4 }, stops: [1, 2, 3] });
  const actual = normalizeTree({ type: 'container', decoration: { color: '#112233', radius: 8 }, stops: [1, 2] });
  const diffs = diffTree(expected, actual);
  const paths = diffs.map((d) => d.path).sort();
  assert.deepEqual(paths, ['container[0].decoration.radius', 'container[0].stops']);
  const radius = diffs.find((d) => d.path === 'container[0].decoration.radius');
  assert.equal(radius.expected, 4);
  assert.equal(radius.actual, 8);
  const stops = diffs.find((d) => d.path === 'container[0].stops');
  assert.equal(stops.expected, 3);
  assert.equal(stops.actual, 2);
});

test('object vs scalar mismatches walk the object side and mark the leaf missing', () => {
  const expected = normalizeTree({ type: 'container', decoration: { color: '#112233' } });
  const actual = normalizeTree({ type: 'container' });
  const diffs = diffTree(expected, actual);
  assert.deepEqual(diffs, [{ path: 'container[0].decoration.color', expected: '#112233', actual: 'missing' }]);
});
