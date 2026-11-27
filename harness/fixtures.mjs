// Fixture and result loading — meta.json is authoritative (plan 1.4).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export class HarnessError extends Error {} // exit 1: usage error or invalid input

export function listFixtureIds(fixturesDir) {
  let entries;
  try {
    entries = readdirSync(fixturesDir);
  } catch (e) {
    throw new HarnessError(`fixtures directory not readable: ${fixturesDir} (${e.message})`);
  }
  return entries.filter((name) => {
    if (!/^[a-z0-9_]+$/.test(name)) return false;
    try { return statSync(join(fixturesDir, name)).isDirectory(); } catch { return false; }
  }).sort();
}

export function loadFixture(fixturesDir, id) {
  const dir = join(fixturesDir, id);
  const metaPath = join(dir, 'meta.json');
  const expectedPath = join(dir, 'expected.json');
  const widgetPath = join(dir, 'widget.js');
  const meta = readJson(metaPath);
  const expected = readJson(expectedPath);
  const widget = readWidget(id, widgetPath);
  validateMeta(id, meta, metaPath);
  validateExpected(id, expected, expectedPath);
  return { id, dir, meta, expected, widget };
}

function readWidget(id, widgetPath) {
  try {
    return readFileSync(widgetPath, 'utf8');
  } catch {
    throw new HarnessError(`fixture ${id}: missing widget.js at ${widgetPath}`);
  }
}

function validateMeta(id, meta, metaPath) {
  if (!Array.isArray(meta.categories) || meta.categories.some((c) => typeof c !== 'string')) {
    throw new HarnessError(`fixture ${id}: meta.json.categories must be an array of strings (${metaPath})`);
  }
  if (meta.capabilities !== undefined && !arrayOfStrings(meta.capabilities)) {
    throw new HarnessError(`fixture ${id}: meta.json.capabilities must be an array of strings (${metaPath})`);
  }
  if (meta.ignore !== undefined && !arrayOfStrings(meta.ignore)) {
    throw new HarnessError(`fixture ${id}: meta.json.ignore must be an array of strings (${metaPath})`);
  }
  validateMock(id, meta.mock, metaPath);
}

function validateMock(id, mock, metaPath) {
  if (mock !== undefined && (mock === null || typeof mock !== 'object' || Array.isArray(mock))) {
    throw new HarnessError(`fixture ${id}: meta.json.mock must be an object (${metaPath})`);
  }
}

function validateExpected(id, expected, expectedPath) {
  assertPlainObject(id, expected, 'expected.json must be an object', expectedPath);
  if (expected.expect === undefined || expected.expect === null || typeof expected.expect !== 'object' || Array.isArray(expected.expect)) {
    throw new HarnessError(`fixture ${id}: expected.json must hold { "expect": { ... } } (${expectedPath})`);
  }
  if (expected.actions !== undefined && !Array.isArray(expected.actions)) {
    throw new HarnessError(`fixture ${id}: expected.json.actions must be an array (${expectedPath})`);
  }
  validateExpect(id, expected.expect, expectedPath);
}

function assertPlainObject(id, value, what, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HarnessError(`fixture ${id}: ${what} (${path})`);
  }
}

const isNonNegativeInt = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isString = (v) => typeof v === 'string';
const isStateObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const EXPECT_CHECKS = [
  ['renders', isNonNegativeInt],
  ['title', isString],
  ['trace', arrayOfStrings],
  ['channels', arrayOfStrings],
  ['console', arrayOfStrings],
  ['state', isStateObject],
];

function validateExpect(id, expect, path) {
  for (const [key, ok] of EXPECT_CHECKS) {
    if (expect[key] !== undefined && !ok(expect[key])) {
      throw new HarnessError(`fixture ${id}: expect.${key} has the wrong type (${path})`);
    }
  }
  validateFinalDumpDelta(id, expect.finalDumpDelta, path);
}

function validateFinalDumpDelta(id, delta, path) {
  if (delta === undefined) return;
  if (typeof delta !== 'object' || delta === null || Array.isArray(delta)) {
    throw new HarnessError(`fixture ${id}: expect.finalDumpDelta must be an object (${path})`);
  }
}

function arrayOfStrings(v) {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function readJson(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new HarnessError(`missing file: ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new HarnessError(`invalid JSON in ${path}: ${e.message}`);
  }
}

export function loadResultFile(path) {
  const result = readJson(path);
  validateResultId(result, path);
  validateResultBasics(result, path);
  return result;
}

function validateResultId(result, path) {
  if (typeof result.fixture !== 'string' || !/^[a-z0-9_]+$/.test(result.fixture)) {
    throw new HarnessError(`result ${path}: "fixture" must be a fixture id string`);
  }
}

function validateResultBasics(result, path) {
  if (typeof result.platform !== 'string') {
    throw new HarnessError(`result ${path}: "platform" must be a string`);
  }
  if (result.status !== 'DONE' && result.status !== 'SKIP') {
    throw new HarnessError(`result ${path}: "status" must be "DONE" or "SKIP" (the runner writes it; the harness writes PASS/FAIL)`);
  }
  if (result.renders !== undefined && !arrayOfStrings(result.renders)) {
    throw new HarnessError(`result ${path}: "renders" must be an array of payload strings`);
  }
}

export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
  return new RegExp(`^${escaped}$`);
}
