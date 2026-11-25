// Boot order — plan 1.4/PROTOCOL 7: __IID, three (capability `three` only),
// runtime half, widget half, widget.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { HarnessError } from './fixtures.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function bootPaths(fixture, { bootstrapDir, threePath } = {}) {
  const dir = bootstrapDir ?? join(REPO_ROOT, 'src');
  const paths = {
    runtime: readBootFile(join(dir, 'bootstrap-runtime.js'), 'bootstrap-runtime.js'),
    widget: readBootFile(join(dir, 'bootstrap-widget.js'), 'bootstrap-widget.js'),
    widgetJs: join(fixture.dir, 'widget.js'),
    three: null,
  };
  if ((fixture.meta.capabilities ?? []).includes('three')) {
    paths.three = readBootFile(threePath ?? join(REPO_ROOT, 'libs', 'three', 'three.min.js'), 'three.min.js');
  }
  return paths;
}

function readBootFile(path, what) {
  try {
    readFileSync(path); // existence check; runners re-read as needed
    return path;
  } catch {
    throw new HarnessError(`${what} not found at ${path} (pass --bootstrap-dir / --three or provide the repository files)`);
  }
}

// Inline engine (node vm, chromium) boot items: code strings in boot order.
export function bootItems(fixture, opts) {
  const paths = bootPaths(fixture, opts);
  const items = [
    { name: '__iid', code: `var __IID = ${JSON.stringify(fixture.id)};\nvar __JSR_MOCK_ORIGIN__ = 'http://127.0.0.1:0';` },
  ];
  if (paths.three) items.push({ name: 'three.min.js', code: readFileSync(paths.three, 'utf8') });
  items.push({ name: 'bootstrap-runtime.js', code: readFileSync(paths.runtime, 'utf8') });
  items.push({ name: 'bootstrap-widget.js', code: readFileSync(paths.widget, 'utf8') });
  items.push({ name: 'widget.js', code: fixture.widget });
  return items;
}
