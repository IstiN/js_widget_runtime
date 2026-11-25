// Shared matrix-fill logic for gen_inventory.mjs and gen_matrix.mjs.
// Fills missing node/prop x platform rows with the start values of
// js_widget_runtime#1: flutter = yes (reference); android = yes for the
// node types of the android POC renderer, no otherwise; ios/macos/web = no.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLATFORMS = ['flutter', 'android', 'ios', 'macos', 'web'];

// Android POC node types: parsed from the pinned NativeRenderer.kt header
// (the doc comment lists the supported node types of the POC).
export function androidPocTypes(conf, inventoryTypes) {
  const types = new Set();
  const nat = readFileSync(
    join(conf, 'android_js_widget_runtime', 'app', 'src', 'main', 'java', 'com', 'test', 'jsr', 'NativeRenderer.kt'),
    'utf8',
  );
  const marker = nat.indexOf('Поддержанные ноды');
  if (marker === -1) throw new Error('POC node list not found in NativeRenderer.kt');
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
