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
    const arg = rest[i];
    if (arg === '--help') { opts.help = true; continue; }
    if (!arg.startsWith('--')) { positionals.push(arg); continue; }
    const flag = arg.slice(2);
    if (!VALUE_FLAGS.has(flag) && flag !== 'write-expect') throw new HarnessError(`unknown flag --${flag}`);
    if (flag === 'write-expect') { opts.writeExpect = true; continue; }
    const value = rest[++i];
    if (value === undefined || value.startsWith('--')) throw new HarnessError(`flag --${flag} needs a value`);
    opts[flag] = value;
  }
  return { command, opts, positionals };
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

async function compareCommand(opts) {
  requireOpts(opts, ['fixtures', 'results', 'out-report']);
  const resultsDir = opts.results;
  let files;
  try {
    files = readdirSync(resultsDir).filter((f) => f.endsWith('.result.json')).sort();
  } catch {
    throw new HarnessError(`results directory not readable: ${resultsDir}`);
  }
  if (files.length === 0) throw new HarnessError(`no *.result.json in ${resultsDir}`);
  const fixturesDir = opts.fixtures;
  const rows = [];
  let platform = null;
  for (const file of files) {
    const path = join(resultsDir, file);
    const result = loadResultFile(path);
    const fixture = loadFixture(fixturesDir, result.fixture); // HarnessError names the path
    if (platform === null) platform = result.platform;
    if (result.status === 'SKIP') {
      rows.push({ fixture: result.fixture, level: levelLabel(fixture), status: 'SKIP', diffs: [], weight: weightFor(fixture.meta.categories) });
      continue;
    }
    const diffs = evaluateResult(fixture, result);
    rows.push({
      fixture: result.fixture,
      level: levelLabel(fixture),
      status: diffs.length > 0 ? 'FAIL' : 'PASS',
      diffs,
      weight: weightFor(fixture.meta.categories),
    });
  }
  const report = renderReport({ platform, rows });
  writeText(opts['out-report'], report);
  if (opts['out-badge']) writeText(opts['out-badge'], JSON.stringify(renderBadge({ platform, rows }), null, 2) + '\n');
  process.stdout.write(report);
  return rows.some((r) => r.status === 'FAIL') ? 2 : 0;
}

function levelLabel(fixture) {
  const categories = fixture.meta.categories ?? [];
  return categories.length ? categories.join('/') : 'unknown';
}

async function runCommand(opts) {
  requireOpts(opts, ['engine', 'fixtures', 'out']);
  const engines = { node: runWithNode, quickjs: runWithQuickjs, chromium: runWithChromium };
  const runner = engines[opts.engine];
  if (!runner) throw new HarnessError(`--engine must be node, quickjs or chromium (got ${opts.engine})`);
  const settleMs = Number(opts.settle ?? 1000);
  if (!Number.isFinite(settleMs) || settleMs < 0) throw new HarnessError(`--settle must be a non-negative number (got ${opts.settle})`);
  const fixturesDir = opts.fixtures;
  let ids = listFixtureIds(fixturesDir);
  if (opts.filter) {
    const re = globToRegExp(opts.filter);
    ids = ids.filter((id) => re.test(id));
  }
  if (ids.length === 0) throw new HarnessError(`no fixtures match in ${fixturesDir}${opts.filter ? ` (filter ${opts.filter})` : ''}`);
  const outDir = opts.out;
  mkdirSync(outDir, { recursive: true });
  const bootOpts = { bootstrapDir: opts['bootstrap-dir'], threePath: opts.three };
  const enginePlatform = { node: 'node', quickjs: 'quickjs', chromium: 'web' };
  let done = 0;
  let skipped = 0;
  for (const id of ids) {
    const fixture = loadFixture(fixturesDir, id);
    if (opts.writeExpect && !fixture.meta.categories.includes('3D-API')) {
      throw new HarnessError(`fixture ${id}: --write-expect is generator mode for 3D-API fixtures only (categories: ${levelLabel(fixture)})`);
    }
    let result;
    if ((fixture.expected.actions?.length ?? 0) > 0) {
      // headless has no hit testing: interactive fixtures belong to platform runners
      result = {
        fixture: id, platform: enginePlatform[opts.engine], status: 'SKIP',
        dump: null, trace: [], diffs: [], screenshot: null, renders: [], finalDump: null,
        title: null, state: null, console: [], error: null,
        skippedReason: 'actions require a rendering runner',
      };
      skipped++;
    } else {
      result = await runner(fixture, { settleMs, ...bootOpts });
      done++;
    }
    if (opts.writeExpect) {
      fixture.expected.expect.state = result.state;
      writeText(join(fixture.dir, 'expected.json'), JSON.stringify(fixture.expected, null, 2) + '\n');
    }
    writeText(join(outDir, `${id}.result.json`), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(`ran ${done} fixture(s), skipped ${skipped} (engine ${opts.engine}) -> ${outDir}`);
  return 0;
}

async function coverageCommand(opts) {
  requireOpts(opts, ['fixtures', 'inventory']);
  let invPath = opts.inventory;
  try {
    if (statSync(invPath).isDirectory()) invPath = join(invPath, '..', 'inventory.json');
  } catch {
    throw new HarnessError(`inventory path not readable: ${invPath}`);
  }
  let inventory;
  try {
    inventory = JSON.parse(readFileSync(invPath, 'utf8'));
  } catch (e) {
    throw new HarnessError(`invalid inventory JSON at ${invPath}: ${e.message}`);
  }
  if (!Array.isArray(inventory.nodes) || inventory.nodes.some((n) => !n || typeof n.type !== 'string')) {
    throw new HarnessError(`inventory must hold nodes[] with type (and optional events[], props[]) at ${invPath}`);
  }
  const fixturesDir = opts.fixtures;
  const fixtures = listFixtureIds(fixturesDir).map((id) => loadFixture(fixturesDir, id));
  const seenTypes = new Set();
  const seenEvents = new Set();
  const seenProps = new Set();
  // ponytail: regex scan of widget.js sources; fixtures are declarative
  // jsr.render payloads, so key-shaped regexes find every node/event/prop.
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

  const missingNodes = [];
  let coveredProps = 0;
  let totalProps = 0;
  for (const node of inventory.nodes) {
    if (!seenTypes.has(node.type)) missingNodes.push(node.type);
    for (const prop of node.props ?? []) {
      totalProps++;
      if (seenProps.has(prop)) coveredProps++;
    }
  }
  const eventKeys = [...new Set(inventory.nodes.flatMap((n) => n.events ?? []))];
  const missingEvents = eventKeys.filter((key) => !seenEvents.has(key));

  const levels = ['L0', 'L1', 'L2', 'L3', 'L4', '3D-API'];
  const perLevel = Object.fromEntries(levels.map((level) => [level, fixtures.filter((f) => f.meta.categories.includes(level)).length]));
  console.log(`nodes: ${inventory.nodes.length - missingNodes.length}/${inventory.nodes.length} covered`);
  if (totalProps > 0) console.log(`props: ${coveredProps}/${totalProps} covered`);
  console.log(`event keys: ${eventKeys.length - missingEvents.length}/${eventKeys.length} covered`);
  for (const level of levels) console.log(`fixtures ${level}: ${perLevel[level]}`);
  if (missingNodes.length > 0 || missingEvents.length > 0) {
    if (missingNodes.length > 0) console.error(`missing node fixtures: ${missingNodes.join(', ')}`);
    if (missingEvents.length > 0) console.error(`missing event fixtures: ${missingEvents.join(', ')}`);
    return 2;
  }
  return 0;
}

async function main(argv) {
  if (argv.length === 0 || argv[0] === '--help') {
    if (argv.length === 0) {
      process.stderr.write(USAGE + '\n');
      return 1;
    }
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  const { command, opts, positionals } = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  switch (command) {
    case 'compare': return compareCommand(opts);
    case 'run': return runCommand(opts);
    case 'coverage': return coverageCommand(opts);
    case 'mock':
      if (positionals.length !== 1) throw new HarnessError('usage: jsr-harness mock <fixture-dir>');
      await runMockCommand(resolveDir(positionals[0]));
      return 0;
    default:
      throw new HarnessError(`unknown command "${command}" (try --help)`);
  }
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
