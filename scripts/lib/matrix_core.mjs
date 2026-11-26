// Shared matrix-fill logic for gen_inventory.mjs and gen_matrix.mjs.
// Fills missing node/prop x platform rows with the start values of
// js_widget_runtime#1: flutter = yes (reference); android = yes for the
// node types of the android POC renderer, no otherwise; ios/macos/web = no.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLATFORMS = ['flutter', 'android', 'ios', 'macos', 'web'];

// Android POC node types: parsed from the pinned NativeRenderer.kt header
// (the doc comment lists the supported node types of the POC). Start values
// only: wave D overwrites every row with the measured platform statuses, so
// a pin that no longer carries the POC header yields an empty set.
export function androidPocTypes(conf, inventoryTypes) {
  const types = new Set();
  let nat;
  try {
    nat = readFileSync(
      join(conf, 'android_js_widget_runtime', 'app', 'src', 'main', 'java', 'com', 'test', 'jsr', 'NativeRenderer.kt'),
      'utf8',
    );
  } catch {
    return types;
  }
  const marker = nat.indexOf('Поддержанные ноды');
  if (marker === -1) return types;
  const tail = nat.slice(marker, marker + 400).split('\n').slice(0, 5).join(' ');
  for (const t of tail.matchAll(/[a-zA-Z][a-zA-Z0-9_]*/g)) {
    if (inventoryTypes.has(t[0])) types.add(t[0]);
  }
  return types;
}

function fill(type, isProp, pocTypes) {
  if (isProp) return { flutter: 'yes', android: 'no', ios: 'no', macos: 'no', web: 'no' };
  return {
    flutter: 'yes',
    android: pocTypes.has(type) ? 'yes' : 'no',
    ios: 'no',
    macos: 'no',
    web: 'no',
  };
}

// Mutates and returns `matrix`, ensuring every inventory node and prop has a
// status row. Existing values are preserved (hand edits survive).
export function fillMatrix(inventory, matrix, pocTypes) {
  const nodeMap = Object.fromEntries(inventory.nodes.map((n) => [n.type, n]));
  for (const [type, node] of Object.entries(nodeMap)) {
    const m = (matrix.nodes[type] = matrix.nodes[type] || {});
    m.platforms = { ...fill(type, false, pocTypes), ...(m.platforms || {}) };
    m.props = m.props || {};
    for (const [prop] of Object.entries(node.props)) {
      m.props[prop] = { ...fill(type, true, pocTypes), ...(m.props[prop] || {}) };
    }
  }
  return matrix;
}

// Wave D: load each platform's docs/node-support.json through the pin and
// map the three file shapes onto the matrix platforms. One explicit mapping
// per shape (documented in PR #4):
//   android_js_widget_runtime: array `[{ type, status, reason? }]` -> android
//   apple_js_widget_runtime:   `{ rows: [{ type, status, ios: { status, reason? } }] }`
//     -> `status` is the macOS column, `rows[].ios.status` the iOS column
//   react_js_widget_runtime:   `{ nodes: { <type>: { status, reason? } } }` -> web
// A type a platform file omits maps to `no` (not implemented there).
export function loadPlatformSupport(conf) {
  const androidRows = JSON.parse(
    readFileSync(join(conf, 'android_js_widget_runtime', 'docs', 'node-support.json'), 'utf8'),
  );
  const appleFile = JSON.parse(
    readFileSync(join(conf, 'apple_js_widget_runtime', 'docs', 'node-support.json'), 'utf8'),
  );
  const reactFile = JSON.parse(
    readFileSync(join(conf, 'react_js_widget_runtime', 'docs', 'node-support.json'), 'utf8'),
  );
  return {
    android: new Map(androidRows.map((r) => [r.type, r])),
    macos: new Map(appleFile.rows.map((r) => [r.type, r])),
    ios: new Map(appleFile.rows.map((r) => [r.type, r.ios ?? {}])),
    web: new Map(Object.entries(reactFile.nodes ?? {}).map(([type, r]) => [type, r])),
  };
}

// Overwrite the node-level rows with the measured platform values and set
// prop rows to the honest final state: flutter = yes (the reference defines
// every prop), every other platform `n/a` — no platform publishes per-prop
// support data at this pin, so a per-prop claim would be invented.
export function applyPlatformSupport(matrix, support, inventoryTypes) {
  for (const type of inventoryTypes) {
    const m = (matrix.nodes[type] = matrix.nodes[type] || { platforms: {}, props: {} });
    m.platforms = {
      flutter: 'yes',
      android: support.android.get(type)?.status ?? 'no',
      ios: support.ios.get(type)?.status ?? 'no',
      macos: support.macos.get(type)?.status ?? 'no',
      web: support.web.get(type)?.status ?? 'no',
    };
    for (const prop of Object.keys(m.props)) {
      m.props[prop] = { flutter: 'yes', android: 'n/a', ios: 'n/a', macos: 'n/a', web: 'n/a' };
    }
  }
  return matrix;
}
