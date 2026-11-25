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
  let widget;
  try {
    widget = readFileSync(widgetPath, 'utf8');
  } catch {
    throw new HarnessError(`fixture ${id}: missing widget.js at ${widgetPath}`);
  }
  if (!Array.isArray(meta.categories) || meta.categories.some((c) => typeof c !== 'string')) {
    throw new HarnessError(`fixture ${id}: meta.json.categories must be an array of strings (${metaPath})`);
  }
  if (meta.capabilities !== undefined && !arrayOfStrings(meta.capabilities)) {
    throw new HarnessError(`fixture ${id}: meta.json.capabilities must be an array of strings (${metaPath})`);
  }
  if (meta.ignore !== undefined && !arrayOfStrings(meta.ignore)) {
    throw new HarnessError(`fixture ${id}: meta.json.ignore must be an array of strings (${metaPath})`);
  }
  if (meta.mock !== undefined && (meta.mock === null || typeof meta.mock !== 'object' || Array.isArray(meta.mock))) {
    throw new HarnessError(`fixture ${id}: meta.json.mock must be an object (${metaPath})`);
  }
  if (expected.expect === undefined || expected.expect === null || typeof expected.expect !== 'object' || Array.isArray(expected.expect)) {
    throw new HarnessError(`fixture ${id}: expected.json must hold { "expect": { ... } } (${expectedPath})`);
  }
  if (expected.actions !== undefined && !Array.isArray(expected.actions)) {
    throw new HarnessError(`fixture ${id}: expected.json.actions must be an array (${expectedPath})`);
  }
  validateExpect(id, expected.expect, expectedPath);
  return { id, dir, meta, expected, widget };
}

function validateExpect(id, expect, path) {
  const checks = [
    ['renders', (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0],
    ['title', (v) => typeof v === 'string'],
    ['trace', arrayOfStrings],
    ['channels', arrayOfStrings],
    ['console', arrayOfStrings],
    ['state', (v) => v !== null && typeof v === 'object' && !Array.isArray(v)],
  ];
  for (const [key, ok] of checks) {
    if (expect[key] !== undefined && !ok(expect[key])) {
      throw new HarnessError(`fixture ${id}: expect.${key} has the wrong type (${path})`);
    }
  }
  if (expect.finalDumpDelta !== undefined && (typeof expect.finalDumpDelta !== 'object' || expect.finalDumpDelta === null || Array.isArray(expect.finalDumpDelta))) {
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
  if (typeof result.fixture !== 'string' || !/^[a-z0-9_]+$/.test(result.fixture)) {
    throw new HarnessError(`result ${path}: "fixture" must be a fixture id string`);
  }
  if (typeof result.platform !== 'string') {
    throw new HarnessError(`result ${path}: "platform" must be a string`);
  }
  if (result.status !== 'DONE' && result.status !== 'SKIP') {
    throw new HarnessError(`result ${path}: "status" must be "DONE" or "SKIP" (the runner writes it; the harness writes PASS/FAIL)`);
  }
  if (result.renders !== undefined && (!Array.isArray(result.renders) || result.renders.some((r) => typeof r !== 'string'))) {
    throw new HarnessError(`result ${path}: "renders" must be an array of payload strings`);
  }
  return result;
}

export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
  return new RegExp(`^${escaped}$`);
}
