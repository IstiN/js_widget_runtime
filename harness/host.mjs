// Shared host emulation for `jsr-harness run` — one module behind all three
// engines (node vm, quickjs, chromium). Channel semantics per
// docs/PROTOCOL.md of IstiN/js_runtime (v0.1): raw-payload channels arrive
// `{iid, id}`-wrapped, promise channels resolve through `__jsrResolve`.
import { readFileSync } from 'node:fs';
import { join, resolve as resolvePath, sep } from 'node:path';
import { normalizeTree } from './normalize.mjs';

const RAW_CHANNELS = new Set(['__jsr_log', '__jsr_set_title', '__jsr_clear_interval', '__jsr_caf', '__jsr_host_call_binary']);
const UNSUPPORTED_PROMISE_CHANNELS = new Set(['__jsr_exec', '__jsr_open_url', '__jsr_host_call', '__jsr_capture']);

// createHost({ fixtureDir, mock, fire }) — fire(action) is provided by the
// engine runner; actions: {type:'resolve'|'interval'|'raf'|'cancel', ...}.
export function createHost({ fixtureDir, mock = {}, fire = () => {} }) {
  const host = {
    trace: [],        // verbs: channel name without the __jsr_ prefix
    renders: [],      // raw __jsr_render payload strings in order
    title: null,      // last __jsr_set_title payload
    consoleLines: [], // all __jsr_log payloads
    state: undefined, // last __jsr_export_state payload
    timers: new Map(),// id -> {kind:'interval'|'raf', ms, once}
    storage: new Map(),
    secrets: new Map(),
    markFired(id) {
      const t = this.timers.get(id);
      if (!t) return;
      if (t.kind === 'raf' || t.once) this.timers.delete(id);
    },
  };

  host.handle = (channel, payload) => {
    const verb = channel.slice('__jsr_'.length);
    host.trace.push(verb);
    if (channel === '__jsr_log') {
      host.consoleLines.push(unwrapRaw(payload));
    } else if (channel === '__jsr_render') {
      host.renders.push(String(payload));
    } else if (channel === '__jsr_set_title') {
      host.title = unwrapRaw(payload);
    } else if (channel === '__jsr_set_interval') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      const ms = typeof p.ms === 'number' && p.ms >= 0 ? p.ms : (p.once ? 0 : 1000);
      host.timers.set(p.id, { kind: 'interval', ms, once: Boolean(p.once) });
      fire({ type: 'interval', id: p.id, ms, once: Boolean(p.once) });
    } else if (channel === '__jsr_clear_interval') {
      const id = unwrapRaw(payload);
      host.timers.delete(id);
      fire({ type: 'cancel', id });
    } else if (channel === '__jsr_raf') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      host.timers.set(p.id, { kind: 'raf' });
      fire({ type: 'raf', id: p.id });
    } else if (channel === '__jsr_caf') {
      const id = unwrapRaw(payload);
      host.timers.delete(id);
      fire({ type: 'cancel', id });
    } else if (channel === '__jsr_fetch') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      fire({ type: 'resolve', id: p.id, value: mockLookup(mock, String(p.url)) });
    } else if (UNSUPPORTED_PROMISE_CHANNELS.has(channel)) {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      fire({ type: 'resolve', id: p.id, value: { __error: `${channel} is not supported by this host` } });
    } else if (channel === '__jsr_storage_get') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      fire({ type: 'resolve', id: p.id, value: host.storage.has(p.key) ? host.storage.get(p.key) : null });
    } else if (channel === '__jsr_storage_set') {
      const p = parseTagged(payload);
      if (!p || typeof p.key !== 'string') return;
      host.storage.set(p.key, p.value);
    } else if (channel === '__jsr_secrets_get') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      fire({ type: 'resolve', id: p.id, value: host.secrets.has(p.key) ? host.secrets.get(p.key) : null });
    } else if (channel === '__jsr_secrets_set') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      host.secrets.set(p.key, p.value);
      fire({ type: 'resolve', id: p.id, value: true });
    } else if (channel === '__jsr_load_asset') {
      const p = parseTagged(payload);
      if (!p || typeof p.id !== 'string') return;
      fire({ type: 'resolve', id: p.id, value: readAsset(fixtureDir, String(p.path)) });
    } else if (channel === '__jsr_export_state') {
      const p = parseTagged(payload);
      host.state = p === undefined ? undefined : p;
    }
    // __jsr_host_call_binary, __jsr_scene3d_command, __jsr_event_done:
    // fire-and-forget lanes, dropped by an unsupported host (PROTOCOL 5).
  };
  return host;
}

export function mockLookup(mock, url) {
  let path;
  try {
    path = new URL(url, 'http://mock.invalid').pathname;
  } catch {
    return { __error: `invalid url: ${url}` };
  }
  const entry = mock[path];
  if (!entry || typeof entry !== 'object') return { __error: `no mock for ${path}` };
  if (typeof entry.status === 'number' && entry.status >= 400) return { __error: `HTTP ${entry.status}` };
  return entry.body !== undefined ? entry.body : {};
}

function readAsset(fixtureDir, path) {
  const root = resolvePath(fixtureDir);
  const full = resolvePath(root, path);
  if (full !== root && !full.startsWith(root + sep)) return null; // stays inside the fixture dir
  try {
    return readFileSync(full, 'utf8');
  } catch {
    return null; // loadAsset never rejects; host failures resolve their own value
  }
}

function unwrapRaw(payload) {
  const s = typeof payload === 'string' ? payload : String(payload);
  const o = parseObject(s);
  if (o && typeof o.id === 'string' && typeof o.iid === 'string' && Object.keys(o).length === 2) return o.id;
  return s;
}

// Object payloads arrive with the routing `iid` merged in (canonical __tag);
// the bridge strips the tag before handlers run (PROTOCOL 1/6).
function parseTagged(payload) {
  const p = parseObject(payload);
  if (p && p.iid !== undefined) delete p.iid;
  return p;
}

function parseObject(payload) {
  if (payload && typeof payload === 'object') return payload;
  if (typeof payload !== 'string') return undefined;
  try {
    const v = JSON.parse(payload);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

// result.json per plan 1.4; headless `run` has no view tree, so `dump` and
// `finalDump` are the normalized render payloads.
export function assembleResult({ fixture, platform, host, status = 'DONE', error = null, skippedReason = null }) {
  let dump = null;
  let finalDump = null;
  if (host.renders.length > 0) {
    dump = normalizeTree(JSON.parse(host.renders[0]));
    finalDump = normalizeTree(JSON.parse(host.renders[host.renders.length - 1]));
  }
  return {
    fixture,
    platform,
    status,
    dump,
    trace: [...host.trace],
    diffs: [],
    screenshot: null,
    renders: [...host.renders],
    finalDump,
    title: host.title,
    state: host.state === undefined ? null : host.state,
    console: [...host.consoleLines],
    error,
    skippedReason,
  };
}
