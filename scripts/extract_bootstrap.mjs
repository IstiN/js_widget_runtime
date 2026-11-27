#!/usr/bin/env node
// extract_bootstrap.mjs — wrapper of this repository around the pinned
// generator (.conformance/js_runtime/scripts/extract_bootstrap.mjs).
//
//   default    write src/bootstrap-runtime.js (byte copy of the js_runtime
//              pin) and src/bootstrap-widget.js (widget half generated from
//              the pinned kJsWidgetBootstrap, with the provenance header)
//   --check    exit 1 when either committed file differs from its generated
//              text, or when the committed runtime half is not byte-equal to
//              bootstrap-runtime.js of the js_runtime pin
//   --help     this text
//
// Flags of the pinned generator used here (see its --help): --reference,
// --pin, --emit-widget. Run scripts/fetch-conformance.sh first.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = process.env.JSR_CONFORMANCE_DIR || join(root, '.conformance');
const runtimePin = join(conf, 'js_runtime', 'bootstrap-runtime.js');
const generator = join(conf, 'js_runtime', 'scripts', 'extract_bootstrap.mjs');
const flutterPin = readFileSync(join(root, 'conformance.lock'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .find((l) => l.startsWith('IstiN/flutter_js_widget_runtime@'))
  .match(/@([0-9a-f]{40})/)[1];
const reference = join(
  conf,
  'flutter_js_widget_runtime',
  'lib',
  'src',
  'runtime',
  'js_widget_bootstrap.dart',
);
const outRuntime = join(root, 'src', 'bootstrap-runtime.js');
const outWidget = join(root, 'src', 'bootstrap-widget.js');
const header =
  `// Generated from IstiN/flutter_js_widget_runtime@${flutterPin.slice(0, 7)}` +
  `:lib/src/runtime/js_widget_bootstrap.dart (widget half) by ` +
  `scripts/extract_bootstrap.mjs — do not edit\n`;

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`usage: extract_bootstrap.mjs [--check|--help]

default  write src/bootstrap-runtime.js (byte copy of the js_runtime pin) and
         src/bootstrap-widget.js (generated widget half + provenance header)
--check  exit 1 on drift of either committed file with its generated text,
         or when the runtime half is not byte-equal to the js_runtime pin
--help   this text`);
  process.exit(0);
}

function generateWidget(dest) {
  const r = spawnSync(
    process.execPath,
    [generator, '--reference', reference, '--pin', flutterPin, '--emit-widget', dest],
    { cwd: root, stdio: 'pipe', encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.error(r.stdout + r.stderr);
    process.exit(r.status ?? 1);
  }
}

if (args.includes('--check')) {
  let bad = false;
  const tmp = mkdtempSync(join(tmpdir(), 'jsr-widget-'));
  try {
    generateWidget(join(tmp, 'widget.js'));
    const generatedWidget = header + readFileSync(join(tmp, 'widget.js'), 'utf8');
    let committed;
    try {
      committed = readFileSync(outWidget, 'utf8');
    } catch {
      console.error('bootstrap drift: src/bootstrap-widget.js is missing');
      bad = true;
    }
    if (committed !== undefined && committed !== generatedWidget) {
      console.error('bootstrap drift: src/bootstrap-widget.js differs from the generated widget half');
      bad = true;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  let committedRuntime;
  try {
    committedRuntime = readFileSync(outRuntime);
  } catch {
    console.error('bootstrap drift: src/bootstrap-runtime.js is missing');
    process.exit(1);
  }
  const pinRuntime = readFileSync(runtimePin);
  if (!committedRuntime.equals(pinRuntime)) {
    console.error('bootstrap drift: src/bootstrap-runtime.js is not byte-equal to the js_runtime pin');
    process.exit(1);
  }
  process.exit(bad ? 1 : 0);
}

writeFileSync(outRuntime, readFileSync(runtimePin));
const tmp = mkdtempSync(join(tmpdir(), 'jsr-widget-'));
try {
  generateWidget(join(tmp, 'widget.js'));
  writeFileSync(outWidget, header + readFileSync(join(tmp, 'widget.js'), 'utf8'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`wrote src/bootstrap-runtime.js (from ${runtimePin.slice(root.length + 1)}) and src/bootstrap-widget.js (pin ${flutterPin.slice(0, 7)})`);
