// Mock server — plan 1.4: serves meta.json.mock until SIGTERM.
// `node harness/harness.mjs mock <fixture-dir>` prints one origin line.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HarnessError } from './fixtures.mjs';

// createMockServer(mock) -> Promise<{ origin, close }>
// mock: { "/path": { "status": 200, "body": {} } }
export function createMockServer(mock = {}) {
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.writeHead(204);
      res.end();
      return;
    }
    const path = req.url.split('?')[0];
    const entry = mock[path];
    if (!entry || typeof entry !== 'object') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ __error: `no mock for ${path}` }));
      return;
    }
    const status = typeof entry.status === 'number' ? entry.status : 200;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(entry.body ?? {}));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }));
  });
}

// Runs the `mock` command: resolves the fixture meta.json, starts the server,
// prints the origin, serves until SIGTERM/SIGINT.
export async function runMockCommand(fixtureDir) {
  const { origin, close } = await createMockServer(loadMock(fixtureDir));
  console.log(origin);
  await serveUntilSignal(close); // hold the event loop; main exits 0 on signal
}

function loadMock(fixtureDir) {
  const metaPath = join(fixtureDir, 'meta.json');
  try {
    return validateMock(metaPath, JSON.parse(readFileSync(metaPath, 'utf8')));
  } catch (e) {
    if (e instanceof HarnessError) throw e;
    throw new HarnessError(`missing or invalid meta.json at ${metaPath}: ${e.message}`);
  }
}

function validateMock(metaPath, meta) {
  if (meta.mock !== undefined && (meta.mock === null || typeof meta.mock !== 'object' || Array.isArray(meta.mock))) {
    throw new HarnessError(`meta.json.mock must be an object (${metaPath})`);
  }
  return meta.mock ?? {};
}

function serveUntilSignal(close) {
  return new Promise((resolve) => {
    const stop = () => { close(); resolve(); };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  });
}
