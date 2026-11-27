// parity.test.js — the parity oracle of the bootstrap split (plan 1.2):
// the reference kJsWidgetBootstrap string and the two committed canonical
// halves run in two identical vm contexts with the same recording fake host;
// ONE driver (test/parity-driver.js) drives every jsr member (13 runtime +
// 19 widget) and every host-to-JS global, and the test requires identical
// channel traces and identical resolved values.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = process.env.JSR_CONFORMANCE_DIR || join(root, '.conformance');

// Reference: the raw kJsWidgetBootstrap string inside the pinned dart file.
const dart = readFileSync(
  join(conf, 'flutter_js_widget_runtime', 'lib', 'src', 'runtime', 'js_widget_bootstrap.dart'),
  'utf8',
);
const begin = dart.indexOf("= r'''") + "= r'''".length;
const end = dart.indexOf("''';", begin);
assert.ok(begin > 6 && end > begin, 'kJsWidgetBootstrap raw string found in the pinned dart file');
const reference = dart.slice(begin, end);

const runtime = readFileSync(join(root, 'src', 'bootstrap-runtime.js'), 'utf8');
const widget = readFileSync(join(root, 'src', 'bootstrap-widget.js'), 'utf8');
const driver = readFileSync(join(root, 'test', 'parity-driver.js'), 'utf8');

// The 32 jsr members (13 runtime + 19 widget) every context must cover.
const RUNTIME_MEMBERS = [
  'audio', 'fetchJson', 'exec', 'hostCall', 'hostCallBinary', 'b64encode',
  'capture', 'storage', 'exportState', 'openUrl', 'secrets', 'loadAsset',
  'scene3d',
];
const WIDGET_MEMBERS = [
  'ease', 'motion', '_easeFn', 'render', 'setTitle', '_handler', 'onEvent',
  '_keyHandler', 'onKey', 'theme', '_onThemeChange', 'onThemeChange',
  '_viewport', '_viewportHandler', 'viewport', 'onViewport', 'breakpoint',
  'adaptive', 'showError',
];

// console.timeEnd logs a wall-clock duration (`label: <N>ms`); it is the one
// nondeterministic payload, normalized identically on both sides.
function normalizeTrace(messages) {
  return messages.map(([channel, payload]) =>
    channel === '__jsr_log' ? [channel, payload.replace(/\d+ms/g, '<ms>')] : [channel, payload],
  );
}

function boot(sources) {
  const messages = [];
  const ctx = vm.createContext({
    sendMessage: (channel, payload) => messages.push([channel, payload]),
    __recorded: () => messages.map((m) => [m[0], m[1]]),
  });
  new vm.Script(['var __IID = "parity-iid";', ...sources, driver].join('\n'), {
    filename: 'parity-context',
  }).runInContext(ctx);
  return { ctx, messages };
}

test('parity: reference bootstrap and the two canonical halves behave identically', async () => {
  const ref = boot([reference]);
  const halves = boot([runtime, widget]);

  const run = async ({ ctx, messages }) => ({
    result: await vm.runInContext('__parityRun()', ctx),
    messages,
  });
  const [r, h] = [await run(ref), await run(halves)];

  // Values cross the vm realm (different Object prototypes): compare as JSON
  // (assert/strict aliases deepEqual to deepStrictEqual).
  const json = (x) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(json(normalizeTrace(h.messages)), json(normalizeTrace(r.messages)),
    'channel traces diverge between the reference and the halves');
  assert.deepEqual(json(h.result.values), json(r.result.values), 'resolved values diverge');

  // Coverage: all 32 jsr members (13 runtime + 19 widget) plus the
  // host-to-JS globals the driver exercises; nothing unverified.
  const GLOBALS = [
    'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', '__jsrHostEvent',
    '__jsrResolve', '__jsrInterval', '__jsrRaf', '__jsrWarmResolve',
  ];
  const members = [...RUNTIME_MEMBERS, ...WIDGET_MEMBERS];
  const expected = members.concat(GLOBALS).sort();
  assert.deepEqual(json(h.result.covered.slice().sort()), json(expected),
    'driver must cover every jsr member and every host-to-JS global');
  for (const m of members) {
    assert.ok(h.result.covered.includes(m), `member not covered: ${m}`);
  }
  assert.deepEqual(json(r.result.covered), json(h.result.covered), 'coverage lists diverge');
});
