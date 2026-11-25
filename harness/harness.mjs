#!/usr/bin/env node
// jsr-harness — JSR conformance harness (plan 1.5). Node >= 20, zero runtime
// dependencies. Exit codes: 0 pass · 1 usage error or invalid input · 2 failures.
// ponytail: fixture promises may reject unhandled (e.g. fetchJson to a mock
// miss); results are judged by compare, not by process crashes.
process.on('unhandledRejection', () => {});
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HarnessError, listFixtureIds, loadFixture, loadResultFile, globToRegExp } from './fixtures.mjs';
import { evaluateResult } from './evaluate.mjs';
import { weightFor } from './score.mjs';
import { renderReport, renderBadge } from './report.mjs';
import { resolveTypeAlias } from './aliases.mjs';
import { runMockCommand } from './mock-server.mjs';
import { runWithNode } from './runner-node.mjs';
import { runWithQuickjs } from './runner-quickjs.mjs';
import { runWithChromium } from './runner-chromium.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `jsr-harness — JSR conformance harness

Usage:
  jsr-harness compare --fixtures <dir> --results <dir> --out-report <file.md> [--out-badge <file.json>]
  jsr-harness run --engine node|quickjs|chromium --fixtures <dir> --out <dir>
        [--filter <glob>] [--write-expect] [--bootstrap-dir <dir>] [--three <file>] [--settle <ms>]
  jsr-harness coverage --fixtures <dir> --inventory <path>
  jsr-harness mock <fixture-dir>

compare   loads every *.result.json, derives the expected AUI from the widget
          renders, compares dump/finalDump/finalDumpDelta and the expect
          fields, writes the markdown report (+ badge JSON), exit 2 on failure.
run       runs fixtures headless (3D-API and L2 logic; fixtures with actions
          are SKIPped). Engines: node = vm context, quickjs = $JSR_QJS_HARNESS,
          chromium = Playwright. Boot order: __IID, three (capability "three"),
          runtime half, widget half, widget.js. --write-expect copies the
          measured state into expect.state (3D-API fixtures only, else exit 1).
coverage  every node type and event key of inventory.json must occur in at
          least one widget.js; prints totals; exit 2 on a gap.
mock      serves meta.json.mock at http://127.0.0.1:<port> until SIGTERM.

Exit codes: 0 pass · 1 usage error or invalid input · 2 failures.`;

const VALUE_FLAGS = new Set(['fixtures', 'results', 'out-report', 'out-badge', 'engine', 'out', 'filter', 'bootstrap-dir', 'three', 'settle', 'inventory']);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    i = parseArg(rest, i, opts, positionals);
  }
  return { command, opts, positionals };
}

function parseArg(rest, i, opts, positionals) {
  const arg = rest[i];
  if (arg === '--help') { opts.help = true; return i; }
  if (!arg.startsWith('--')) { positionals.push(arg); return i; }
  return parseValueFlag(rest, i, opts);
}

function parseValueFlag(rest, i, opts) {
  const flag = rest[i].slice(2);
  if (!VALUE_FLAGS.has(flag) && flag !== 'write-expect') throw new HarnessError(`unknown flag --${flag}`);
  if (flag === 'write-expect') { opts.writeExpect = true; return i; }
  const value = rest[++i];
  if (value === undefined || value.startsWith('--')) throw new HarnessError(`flag --${flag} needs a value`);
  opts[flag] = value;
  return i;
}

function requireOpts(opts, keys) {
  for (const key of keys) {
    if (opts[key] === undefined) throw new HarnessError(`missing required flag --${key}`);
  }
}

function writeText(path, text) {
  mkdirSync(dirname(resolvePath(path)), { recursive: true });
  writeFileSync(path, text);
}

function listResultFiles(resultsDir) {
  let files;
  try {
    files = readdirSync(resultsDir).filter((f) => f.endsWith('.result.json')).sort();
  } catch {
    throw new HarnessError(`results directory not readable: ${resultsDir}`);
  }
  return files;
}

async function compareCommand(opts) {
  requireOpts(opts, ['fixtures', 'results', 'out-report']);
  const files = listResultFiles(opts.results);
  if (files.length === 0) {
    // an empty results directory proves nothing: verdict FAILURE, not a
    // silent 0-passed/0-failed score
    const message = `no *.result.json in ${opts.results} — nothing was verified`;
    writeText(opts['out-report'], `# Conformance report\n\nFAILED: ${message}\n`);
    process.stderr.write(`jsr-harness: compare FAILED: ${message}\n`);
    return 2;
  }
  const rows = [];
  let platform = null;
  for (const file of files) {
    const result = loadResultFile(join(opts.results, file));
    const fixture = loadFixture(opts.fixtures, result.fixture); // HarnessError names the path
    if (platform === null) platform = result.platform;
    rows.push(resultRow(result, fixture));
  }
  const report = renderReport({ platform, rows });
  writeText(opts['out-report'], report);
  if (opts['out-badge']) writeText(opts['out-badge'], JSON.stringify(renderBadge({ platform, rows }), null, 2) + '\n');
  process.stdout.write(report);
  return rows.some((r) => r.status === 'FAIL') ? 2 : 0;
}

function resultRow(result, fixture) {
  const level = levelLabel(fixture);
  const weight = weightFor(fixture.meta.categories);
  if (result.status === 'SKIP') return { fixture: result.fixture, level, status: 'SKIP', diffs: [], weight };
  const diffs = evaluateResult(fixture, result);
  return { fixture: result.fixture, level, status: diffs.length > 0 ? 'FAIL' : 'PASS', diffs, weight };
}

function levelLabel(fixture) {
  const categories = fixture.meta.categories ?? [];
  return categories.length ? categories.join('/') : 'unknown';
}

function engineRunner(engine) {
  const engines = { node: runWithNode, quickjs: runWithQuickjs, chromium: runWithChromium };
  const runner = engines[engine];
  if (!runner) throw new HarnessError(`--engine must be node, quickjs or chromium (got ${engine})`);
  return runner;
}

function settleMsOpt(opts) {
  const settleMs = Number(opts.settle ?? 1000);
  if (!Number.isFinite(settleMs) || settleMs < 0) throw new HarnessError(`--settle must be a non-negative number (got ${opts.settle})`);
  return settleMs;
}

function selectFixtureIds(opts) {
  let ids = listFixtureIds(opts.fixtures);
  if (opts.filter) {
    const re = globToRegExp(opts.filter);
    ids = ids.filter((id) => re.test(id));
  }
  if (ids.length === 0) throw new HarnessError(`no fixtures match in ${opts.fixtures}${opts.filter ? ` (filter ${opts.filter})` : ''}`);
  return ids;
}

function assertWriteExpectFixture(writeExpect, fixture) {
  if (writeExpect && !fixture.meta.categories.includes('3D-API')) {
    throw new HarnessError(`fixture ${fixture.id}: --write-expect is generator mode for 3D-API fixtures only (categories: ${levelLabel(fixture)})`);
  }
}

// headless has no hit testing and no renderer: interactive fixtures and
// fixtures whose finalDumpDelta asserts renderer-side values (defaults,
// live text, transforms) belong to platform runners
function headlessSkipReason(fixture) {
  if ((fixture.expected.actions?.length ?? 0) > 0) return 'actions require a rendering runner';
  const delta = fixture.expected.expect.finalDumpDelta;
  if (delta && typeof delta === 'object' && Object.keys(delta).length > 0) {
    return 'renderer assertions (finalDumpDelta) require a rendering runner';
  }
  return null;
}

function skipRow(fixture, engine, skippedReason) {
  const enginePlatform = { node: 'node', quickjs: 'quickjs', chromium: 'web' };
  return {
    fixture: fixture.id, platform: enginePlatform[engine], status: 'SKIP',
    dump: null, trace: [], diffs: [], screenshot: null, renders: [], finalDump: null,
    title: null, state: null, console: [], error: null,
    skippedReason,
  };
}

function writeExpectState(fixture, result) {
  fixture.expected.expect.state = result.state;
  writeText(join(fixture.dir, 'expected.json'), JSON.stringify(fixture.expected, null, 2) + '\n');
}

async function runCommand(opts) {
  requireOpts(opts, ['engine', 'fixtures', 'out']);
  const runner = engineRunner(opts.engine);
  const settleMs = settleMsOpt(opts);
  const ids = selectFixtureIds(opts);
  mkdirSync(opts.out, { recursive: true });
  const bootOpts = { bootstrapDir: opts['bootstrap-dir'], threePath: opts.three };
  let done = 0;
  let skipped = 0;
  for (const id of ids) {
    const fixture = loadFixture(opts.fixtures, id);
    assertWriteExpectFixture(opts.writeExpect, fixture);
    const skipReason = headlessSkipReason(fixture);
    const result = skipReason ? skipRow(fixture, opts.engine, skipReason) : await runner(fixture, { settleMs, ...bootOpts });
    if (skipReason) skipped++; else done++;
    if (opts.writeExpect) writeExpectState(fixture, result);
    writeText(join(opts.out, `${id}.result.json`), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(`ran ${done} fixture(s), skipped ${skipped} (engine ${opts.engine}) -> ${opts.out}`);
  return 0;
}

function loadInventory(invPath) {
  let path = invPath;
  try {
    if (statSync(path).isDirectory()) path = join(path, '..', 'inventory.json');
  } catch {
    throw new HarnessError(`inventory path not readable: ${invPath}`);
  }
  let inventory;
  try {
    inventory = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new HarnessError(`invalid inventory JSON at ${path}: ${e.message}`);
  }
  if (!Array.isArray(inventory.nodes) || inventory.nodes.some((n) => !n || typeof n.type !== 'string')) {
    throw new HarnessError(`inventory must hold nodes[] with type (and optional events[], props[]) at ${path}`);
  }
  return inventory;
}

// ponytail: regex scan of widget.js sources; fixtures are declarative
// jsr.render payloads, so key-shaped regexes find every node/event/prop.
function scanFixtures(fixtures) {
  const seenTypes = new Set();
  const seenEvents = new Set();
  const seenProps = new Set();
  for (const fixture of fixtures) {
    for (const m of fixture.widget.matchAll(/(?:^|[,{\s])type\s*:\s*['"]([^'"]+)['"]/g)) {
      seenTypes.add(resolveTypeAlias(m[1]));
    }
    for (const m of fixture.widget.matchAll(/\b(on[A-Z][A-Za-z0-9_]*)\s*:/g)) {
      seenEvents.add(m[1]);
    }
    for (const m of fixture.widget.matchAll(/\b([a-zA-Z][A-Za-z0-9_]*)\s*:/g)) {
      seenProps.add(m[1]);
    }
  }
  return { seenTypes, seenEvents, seenProps };
}

// props may be a name array or a prop map ({ "<name>": {...} }) — both count as names
function propNamesOf(node) {
  if (Array.isArray(node.props)) return node.props;
  if (node.props && typeof node.props === 'object') return Object.keys(node.props);
  return [];
}

function coverageCounts(inventory, { seenTypes, seenEvents, seenProps }) {
  const missingNodes = [];
  let coveredProps = 0;
  let totalProps = 0;
  for (const node of inventory.nodes) {
    if (!seenTypes.has(node.type)) missingNodes.push(node.type);
    for (const prop of propNamesOf(node)) {
      totalProps++;
      if (seenProps.has(prop)) coveredProps++;
    }
  }
  const eventKeys = [...new Set(inventory.nodes.flatMap((n) => n.events ?? []))];
  const missingEvents = eventKeys.filter((key) => !seenEvents.has(key));
  return { missingNodes, coveredProps, totalProps, eventKeys, missingEvents };
}

function printCoverage(inventory, counts, fixtures) {
  const levels = ['L0', 'L1', 'L2', 'L3', 'L4', '3D-API'];
  console.log(`nodes: ${inventory.nodes.length - counts.missingNodes.length}/${inventory.nodes.length} covered`);
  if (counts.totalProps > 0) console.log(`props: ${counts.coveredProps}/${counts.totalProps} covered`);
  console.log(`event keys: ${counts.eventKeys.length - counts.missingEvents.length}/${counts.eventKeys.length} covered`);
  for (const level of levels) {
    const n = fixtures.filter((f) => f.meta.categories.includes(level)).length;
    console.log(`fixtures ${level}: ${n}`);
  }
}

function coverageVerdict({ missingNodes, missingEvents }) {
  if (missingNodes.length > 0) console.error(`missing node fixtures: ${missingNodes.join(', ')}`);
  if (missingEvents.length > 0) console.error(`missing event fixtures: ${missingEvents.join(', ')}`);
  return missingNodes.length > 0 || missingEvents.length > 0 ? 2 : 0;
}

async function coverageCommand(opts) {
  requireOpts(opts, ['fixtures', 'inventory']);
  const inventory = loadInventory(opts.inventory);
  const fixtures = listFixtureIds(opts.fixtures).map((id) => loadFixture(opts.fixtures, id));
  const counts = coverageCounts(inventory, scanFixtures(fixtures));
  printCoverage(inventory, counts, fixtures);
  return coverageVerdict(counts);
}

function usageExit(argv) {
  if (argv.length === 0) {
    process.stderr.write(USAGE + '\n');
    return 1;
  }
  process.stdout.write(USAGE + '\n');
  return 0;
}

function dispatchCommand(command, opts, positionals) {
  switch (command) {
    case 'compare': return compareCommand(opts);
    case 'run': return runCommand(opts);
    case 'coverage': return coverageCommand(opts);
    case 'mock': return mockCommand(positionals);
    default: throw new HarnessError(`unknown command "${command}" (try --help)`);
  }
}

async function mockCommand(positionals) {
  if (positionals.length !== 1) throw new HarnessError('usage: jsr-harness mock <fixture-dir>');
  await runMockCommand(resolveDir(positionals[0]));
  return 0;
}

async function main(argv) {
  if (argv.length === 0 || argv[0] === '--help') return usageExit(argv);
  const { command, opts, positionals } = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  return dispatchCommand(command, opts, positionals);
}

function resolveDir(p) {
  return isAbsolute(p) ? p : resolvePath(process.cwd(), p);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(`jsr-harness: ${e instanceof HarnessError ? e.message : (e.stack ?? e)}`);
    process.exit(1);
  },
);
