// `run --engine node`: vm context, real timers driven host-side.
import vm from 'node:vm';
import { bootItems } from './boot.mjs';
import { createHost, assembleResult } from './host.mjs';

export async function runWithNode(fixture, { settleMs = 1000, ...bootOpts } = {}) {
  const items = bootItems(fixture, bootOpts);
  const pendingById = new Map();
  const start = Date.now();
  let error = null;
  const ctx = vm.createContext({ sendMessage: (channel, payload) => host.handle(channel, payload) });
  const callInEngine = (code) => {
    try {
      vm.runInContext(code, ctx, { filename: 'jsr-host-call' });
    } catch (e) {
      if (!error) error = `host call failed: ${e.message}`;
    }
  };
  const schedule = (id, ms, code) => {
    const t = setTimeout(() => {
      pendingById.delete(id);
      host.markFired(id);
      callInEngine(code);
    }, ms);
    pendingById.set(id, t);
  };
  const host = createHost({
    fixtureDir: fixture.dir,
    mock: fixture.meta.mock ?? {},
    fire: (action) => fireAction(action, { callInEngine, schedule, pendingById, start }),
  });
  runItems(items, ctx, (e) => { if (!error) error = e; });
  await new Promise((resolve) => setTimeout(resolve, settleMs));
  for (const t of pendingById.values()) clearTimeout(t);
  return assembleResult({ fixture: fixture.id, platform: 'node', host, error });
}

function fireAction(action, { callInEngine, schedule, pendingById, start }) {
  if (action.type === 'resolve') {
    callInEngine(`__jsrResolve(${JSON.stringify(action.id)}, ${JSON.stringify(action.value) ?? 'undefined'})`);
  } else if (action.type === 'interval') {
    schedule(action.id, action.ms, `__jsrInterval(${JSON.stringify(action.id)})`);
  } else if (action.type === 'raf') {
    schedule(action.id, 16, `__jsrRaf(${JSON.stringify(action.id)}, ${Date.now() - start})`);
  } else if (action.type === 'cancel') {
    const t = pendingById.get(action.id);
    if (t) { clearTimeout(t); pendingById.delete(action.id); }
  }
}

function runItems(items, ctx, onError) {
  for (const item of items) {
    try {
      vm.runInContext(item.code, ctx, { filename: item.name });
    } catch (e) {
      onError(`${item.name}: ${e.message}`);
      break;
    }
  }
}
