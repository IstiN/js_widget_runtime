import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer } from '../../harness/mock-server.mjs';

async function get(url, method = 'GET') {
  const res = await fetch(url, { method });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

test('mock server serves the meta.json.mock map with CORS', async () => {
  const { origin, close } = await createMockServer({ '/data': { status: 200, body: { answer: 42 } } });
  try {
    assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    const hit = await get(`${origin}/data`);
    assert.equal(hit.status, 200);
    assert.deepEqual(JSON.parse(hit.body), { answer: 42 });
    const cors = hit.headers.get('access-control-allow-origin');
    assert.equal(cors, '*');
    const query = await get(`${origin}/data?x=1`);
    assert.equal(query.status, 200);
    const miss = await get(`${origin}/nope`);
    assert.equal(miss.status, 404);
    assert.deepEqual(JSON.parse(miss.body), { __error: 'no mock for /nope' });
    const custom = await createMockServer({ '/e': { status: 500, body: { oops: true } } });
    try {
      assert.equal((await get(`${custom.origin}/e`)).status, 500);
    } finally {
      custom.close();
    }
    const options = await get(origin, 'OPTIONS');
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('access-control-allow-origin'), '*');
  } finally {
    close();
  }
});

test('empty mock map answers 404 everywhere but still starts', async () => {
  const { origin, close } = await createMockServer();
  try {
    assert.equal((await get(`${origin}/x`)).status, 404);
  } finally {
    close();
  }
});
