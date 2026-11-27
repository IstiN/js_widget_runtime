import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { loadFixture, loadResultFile, HarnessError } from '../../harness/fixtures.mjs';

const WIDGET = 'jsr.render({type:"text",data:"x"});';

// Writes a fixture directory with the given meta/expected JSON text (raw, so
// invalid JSON shapes are expressible) and returns its parent directory.
function writeFixture(id, metaText, expectedText, widget = WIDGET) {
  const root = mkdtempSync(join(tmpdir(), 'jsr-fix-'));
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  if (metaText !== null) writeFileSync(join(dir, 'meta.json'), metaText);
  if (expectedText !== null) writeFileSync(join(dir, 'expected.json'), expectedText);
  if (widget !== null) writeFileSync(join(dir, 'widget.js'), widget);
  return root;
}

const validMeta = { categories: ['L0'], capabilities: [], ignore: [], mock: {} };
const validExpect = { expect: { renders: 1 } };

function expectHarnessError(fn, fragment) {
  assert.throws(fn, (e) => e instanceof HarnessError && e.message.includes(fragment));
}

test('loadFixture returns id, dir, meta, expected and the widget source', () => {
  const root = writeFixture('ok_one', JSON.stringify(validMeta), JSON.stringify(validExpect));
  const fx = loadFixture(root, 'ok_one');
  assert.equal(fx.id, 'ok_one');
  assert.deepEqual(fx.meta.categories, ['L0']);
  assert.match(fx.widget, /jsr\.render/);
});

test('meta.json field types are validated', () => {
  const cases = [
    ['bad_categories', { ...validMeta, categories: 'L0' }, validExpect, 'categories'],
    ['bad_categories2', { ...validMeta, categories: [1] }, validExpect, 'categories'],
    ['bad_capabilities', { ...validMeta, capabilities: 'network' }, validExpect, 'capabilities'],
    ['bad_ignore', { ...validMeta, ignore: 'color' }, validExpect, 'ignore'],
    ['bad_mock', { ...validMeta, mock: [] }, validExpect, 'mock'],
    ['bad_mock_null', { ...validMeta, mock: null }, validExpect, 'mock'],
    ['no_widget', validMeta, validExpect, 'widget.js'],
    ['no_meta', validMeta, validExpect, 'missing file'],
  ];
  for (const [id, meta, expected, fragment] of cases) {
    const root = writeFixture(id, JSON.stringify(meta), JSON.stringify(expected), id === 'no_widget' ? null : WIDGET);
    if (id === 'no_meta') {
      const rootNoMeta = writeFixture(id, null, JSON.stringify(expected));
      expectHarnessError(() => loadFixture(rootNoMeta, id), fragment);
    } else {
      expectHarnessError(() => loadFixture(root, id), fragment);
    }
  }
});

test('expected.json field types are validated', () => {
  const cases = [
    ['no_expect', 'null', 'expect'],
    ['bad_actions', JSON.stringify({ expect: {}, actions: 'tap' }), 'actions'],
    ['bad_renders', JSON.stringify({ expect: { renders: 'x' } }), 'renders'],
    ['bad_renders_neg', JSON.stringify({ expect: { renders: -1 } }), 'renders'],
    ['bad_trace', JSON.stringify({ expect: { trace: 'render' } }), 'trace'],
    ['bad_channels', JSON.stringify({ expect: { channels: [1] } }), 'channels'],
    ['bad_console', JSON.stringify({ expect: { console: 'log' } }), 'console'],
    ['bad_state', JSON.stringify({ expect: { state: [1] } }), 'state'],
    ['bad_title', JSON.stringify({ expect: { title: 5 } }), 'title'],
    ['bad_delta', JSON.stringify({ expect: { finalDumpDelta: [] } }), 'finalDumpDelta'],
    ['bad_expect_array', JSON.stringify([1]), 'expect'],
  ];
  for (const [id, expectedText, fragment] of cases) {
    const root = writeFixture(id, JSON.stringify(validMeta), expectedText);
    expectHarnessError(() => loadFixture(root, id), fragment);
  }
});

test('valid accept variants pass (prop map, missing optionals, finalDumpDelta object)', () => {
  const meta = { categories: ['L2', '3D-API'] };
  const expected = { expect: { renders: 0, finalDumpDelta: { 'text[0].data': 'x' } } };
  const root = writeFixture('ok_variants', JSON.stringify(meta), JSON.stringify(expected));
  const fx = loadFixture(root, 'ok_variants');
  assert.deepEqual(fx.meta.categories, ['L2', '3D-API']);
  expectHarnessError(() => loadFixture(root, 'absent'), 'missing file');
});

test('invalid JSON is named by path', () => {
  const root = writeFixture('broken_json', '{not json', JSON.stringify(validExpect));
  expectHarnessError(() => loadFixture(root, 'broken_json'), 'invalid JSON');
});

test('loadResultFile validates the result contract', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'jsr-res-')), 'r.result.json');
  const write = (obj) => writeFileSync(path, JSON.stringify(obj));
  write({ fixture: 'ok_id', platform: 'node', status: 'DONE' });
  assert.equal(loadResultFile(path).fixture, 'ok_id');
  write({ fixture: 'Bad Id', platform: 'node', status: 'DONE' });
  expectHarnessError(() => loadResultFile(path), '"fixture"');
  write({ fixture: 'ok_id', platform: 7, status: 'DONE' });
  expectHarnessError(() => loadResultFile(path), '"platform"');
  write({ fixture: 'ok_id', platform: 'node', status: 'PASS' });
  expectHarnessError(() => loadResultFile(path), '"status"');
  write({ fixture: 'ok_id', platform: 'node', status: 'DONE', renders: [1] });
  expectHarnessError(() => loadResultFile(path), '"renders"');
  writeFileSync(path, '{broken');
  expectHarnessError(() => loadResultFile(path), 'invalid JSON');
});
