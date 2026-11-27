import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHost, mockLookup, assembleResult } from '../../harness/host.mjs';

// Channel handler tests: documented payload in, documented action out
// (docs/PROTOCOL.md of the js_runtime pin). The fire callback records the
// host-to-JS actions the engine runner would execute.
function recordingHost(mock = {}, fixtureDir = undefined) {
  const actions = [];
  const host = createHost({
    fixtureDir: fixtureDir ?? mkdtempSync(join(tmpdir(), 'jsr-host-')),
    mock,
    fire: (action) => actions.push(action),
  });
  return { host, actions };
}

test('raw channels unwrap {iid,id} wrappers', () => {
  const { host } = recordingHost();
  host.handle('__jsr_log', JSON.stringify({ iid: 'i1', id: 'hello' }));
  host.handle('__jsr_set_title', 'plain title');
  assert.deepEqual(host.consoleLines, ['hello']);
  assert.equal(host.title, 'plain title');
  assert.deepEqual(host.trace, ['log', 'set_title']);
});

test('interval registers a timer and fires the interval action; caf cancels', () => {
  const { host, actions } = recordingHost();
  host.handle('__jsr_set_interval', JSON.stringify({ iid: 'i', id: 't1', ms: 250 }));
  host.handle('__jsr_set_interval', JSON.stringify({ iid: 'i', id: 't2', once: true }));
  host.handle('__jsr_raf', JSON.stringify({ iid: 'i', id: 'f1' }));
  assert.deepEqual(actions, [
    { type: 'interval', id: 't1', ms: 250, once: false },
    { type: 'interval', id: 't2', ms: 0, once: true },
    { type: 'raf', id: 'f1' },
  ]);
  host.handle('__jsr_caf', 'f1');
  host.markFired('t2'); // once timers drop on fire
  assert.deepEqual([...host.timers.keys()], ['t1']);
});

test('promise channels resolve through fire with the documented values', () => {
  const { host, actions } = recordingHost({
    '/data': { status: 200, body: { answer: 42 } },
  });
  host.handle('__jsr_fetch', JSON.stringify({ iid: 'i', id: 'r1', url: 'http://x/data' }));
  host.handle('__jsr_storage_get', JSON.stringify({ iid: 'i', id: 'r2', key: 'missing' }));
  host.handle('__jsr_storage_set', JSON.stringify({ iid: 'i', key: 'k', value: 'v' }));
  host.handle('__jsr_storage_get', JSON.stringify({ iid: 'i', id: 'r3', key: 'k' }));
  host.handle('__jsr_secrets_set', JSON.stringify({ iid: 'i', id: 'r4', key: 's', value: 'sec' }));
  host.handle('__jsr_exec', JSON.stringify({ iid: 'i', id: 'r5' }));
  assert.deepEqual(actions, [
    { type: 'resolve', id: 'r1', value: { answer: 42 } },
    { type: 'resolve', id: 'r2', value: null },
    { type: 'resolve', id: 'r3', value: 'v' },
    { type: 'resolve', id: 'r4', value: true },
    { type: 'resolve', id: 'r5', value: { __error: '__jsr_exec is not supported by this host' } },
  ]);
});

test('loadAsset resolves fixture files and escapes outside paths as null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jsr-host-'));
  writeFileSync(join(dir, 'data.txt'), 'asset text');
  const { host, actions } = recordingHost({}, dir);
  host.handle('__jsr_load_asset', JSON.stringify({ iid: 'i', id: 'a1', path: 'data.txt' }));
  host.handle('__jsr_load_asset', JSON.stringify({ iid: 'i', id: 'a2', path: '../outside.txt' }));
  host.handle('__jsr_load_asset', JSON.stringify({ iid: 'i', id: 'a3', path: 'nope.txt' }));
  assert.deepEqual(actions.map((a) => a.value), ['asset text', null, null]);
});

test('exportState keeps the last payload; unknown channels only trace', () => {
  const { host, actions } = recordingHost();
  host.handle('__jsr_export_state', JSON.stringify({ iid: 'i', n: 1 }));
  host.handle('__jsr_export_state', JSON.stringify({ iid: 'i', n: 2 }));
  host.handle('__jsr_host_call_binary', JSON.stringify({ iid: 'i', id: 'x' }));
  assert.deepEqual(host.state, { n: 2 });
  assert.deepEqual(actions, []);
  assert.deepEqual(host.trace, ['export_state', 'export_state', 'host_call_binary']);
});

test('mockLookup resolves url paths against the mock map', () => {
  const mock = { '/a': { status: 200, body: [1, 2] }, '/b': { status: 500, body: {} } };
  assert.deepEqual(mockLookup(mock, 'http://host/a?x=1'), [1, 2]);
  assert.deepEqual(mockLookup(mock, 'http://host/b'), { __error: 'HTTP 500' });
  assert.deepEqual(mockLookup(mock, 'http://host/c'), { __error: 'no mock for /c' });
  assert.deepEqual(mockLookup(mock, 'http://['), { __error: 'invalid url: http://[' });
});

test('assembleResult mirrors the result.json contract', () => {
  const { host } = recordingHost();
  const render = { type: 'column', props: {}, children: [] };
  host.handle('__jsr_render', JSON.stringify(render));
  const result = assembleResult({ fixture: 'f', platform: 'node', host });
  assert.equal(result.status, 'DONE');
  assert.equal(result.fixture, 'f');
  assert.equal(result.platform, 'node');
  assert.equal(result.error, null);
  assert.equal(result.dump.type, 'column');
  assert.deepEqual(result.renders, [JSON.stringify(render)]);
  assert.equal(result.state, null);
});
