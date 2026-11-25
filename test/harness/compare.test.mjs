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

test('numbers compare with tolerance +-1, strings and colors exact', () => {
  const expected = rawTree(12);
  assert.deepEqual(diffTree(expected, rawTree(13)), []);
  const diffs = diffTree(expected, rawTree(14));
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].path, 'column[0].spacing');
  assert.ok(diffTree(expected, rawTree(12, { color: '#AABBCD' })).some((d) => d.path.endsWith('.color')));
  assert.ok(diffTree(expected, rawTree(12, { a: 'X' })).some((d) => d.path === 'text[0].data'));
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
  const actual = sample();
  actual.children[1].props.decoration = { shadow: 3 };
  assert.ok(diffTree(expected, actual).length > 0);
  assert.deepEqual(diffTree(expected, actual, new Set(['decoration'])), []);
  assert.deepEqual(diffTree(expected, sample(), new Set(['spacing'])), []);
});

test('missing props, extra props and missing nodes are diffs', () => {
  const expected = sample();
  const withoutSpacing = normalizeTree({ type: 'column', children: expected.children });
  assert.ok(diffTree(expected, withoutSpacing).some((d) => d.path === 'column[0].spacing' && d.actual === 'missing'));
  const withExtra = sample();
  withExtra.children[0].props.extra = 1;
  assert.ok(diffTree(expected, withExtra).some((d) => d.path === 'text[0].extra' && d.expected === 'missing'));
  const fewer = normalizeTree({ type: 'column', spacing: 12, children: [expected.children[0]] });
  const diffs = diffTree(expected, fewer);
  assert.ok(diffs.some((d) => d.path === 'column[0].children' && d.expected === 2 && d.actual === 1));
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

test('checkDelta reports missing paths and applies tolerance', () => {
  const tree = sample();
  assert.deepEqual(checkDelta(tree, { 'text[0].data': 'A', 'text[1].fontSize': 21 }), []);
  assert.equal(checkDelta(tree, { 'text[0].data': 'X' }).length, 1);
  assert.equal(checkDelta(tree, { 'text[9].data': 'A' })[0].actual, 'missing');
  assert.equal(checkDelta(tree, { 'text[1].fontSize': 22 })[0].actual, 20);
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

test('valuesEqual: number tolerance, strict everything else', () => {
  assert.equal(valuesEqual(10, 9), true);
  assert.equal(valuesEqual(10, 8.9), false);
  assert.equal(valuesEqual('#AA', '#AA'), true);
  assert.equal(valuesEqual(0, false), false);
  assert.equal(valuesEqual(null, undefined), false);
});
