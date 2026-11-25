// Shared helpers for the harness tests.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const FIXTURES = join(REPO_ROOT, 'test', 'harness', 'fixtures');
export const STUB = join(REPO_ROOT, 'test', 'harness', 'stub');
export const HARNESS = join(REPO_ROOT, 'harness', 'harness.mjs');

export function makeTmp() {
  return mkdtempSync(join(tmpdir(), 'jsr-harness-test-'));
}

export function copyFixtures() {
  const dir = makeTmp();
  cpSync(FIXTURES, join(dir, 'fixtures'), { recursive: true });
  return join(dir, 'fixtures');
}

export function runCli(args, env = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [HARNESS, ...args],
      { cwd: REPO_ROOT, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}
