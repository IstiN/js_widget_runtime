// AUI normalization — plan 1.3 rules 1..7, one implementation for the family.
import { resolveTypeAlias } from './aliases.mjs';

const STRUCTURAL = new Set(['type', 'child', 'children', 'items', 'key', 'style', 'props', 'events', 'nodeId', '__iid']);
const COLOR_KEY = /color/i;

// Colors become `#RRGGBB` or `#RRGGBBAA` with upper-case hex (plan 1.3 rule 6).
// Named CSS colors are out of contract: fixtures use hex/rgb() only.
export function normalizeColor(value) {
  if (typeof value !== 'string') return value;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      return '#' + [...h].map((c) => c + c).join('').toUpperCase();
    }
    if (h.length === 6 || h.length === 8) return '#' + h.toUpperCase();
    return value;
  }
  const rgb = /^rgba?\(\s*([^)]+?)\s*\)$/i.exec(value.trim());
  if (rgb) {
    const nums = rgb[1].split(/[\s,+/]+/).map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length !== 3 && nums.length !== 4) return value;
    const byte = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const alpha = nums.length === 4 ? (nums[3] > 1 ? nums[3] / 255 : nums[3]) : null; // ponytail: alpha > 1 read as 0-255 scale
    let out = '#' + nums.slice(0, 3).map((n) => byte(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (alpha !== null) out += byte(Math.round(alpha * 255)).toString(16).padStart(2, '0').toUpperCase();
    return out;
  }
  return value;
}

// Accepts the protocol v0.1 `{ root: {...} }` wrapper for integration safety;
// the canonical dump is the root node itself.
export function normalizeTree(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('normalizeTree: payload is not a node object');
  }
  let root = payload;
  if (root.type === undefined && root.root && typeof root.root === 'object' && !Array.isArray(root.root)) {
    root = root.root;
  }
  const tree = buildNode(root);
  assignNodeIds(tree, { i: 0 });
  return tree;
}

function buildNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new TypeError('normalizeTree: node is not an object');
  }
  if (typeof node.type !== 'string') throw new TypeError('normalizeTree: node without string type');
  const out = { type: resolveTypeAlias(node.type) };
  const props = {};
  const events = isPlainObject(node.events) ? { ...node.events } : {};
  for (const [k, v] of Object.entries(node)) {
    if (STRUCTURAL.has(k) || k === 'events') continue;
    if (/^on[A-Z]/.test(k) && typeof v === 'string') { events[k] = v; continue; } // rule 2
    props[k] = normalizePropValue(k, v); // rule 6
  }
  if (isPlainObject(node.props)) { // idempotency: already-normalized nodes merge their props
    for (const [k, v] of Object.entries(node.props)) {
      if (!(k in props) && !(k in events)) props[k] = normalizePropValue(k, v);
    }
  }
  if (isPlainObject(node.style)) { // rule 1: node keys win over style keys
    for (const [k, v] of Object.entries(node.style)) {
      if (!(k in props) && !(k in events)) props[k] = normalizePropValue(k, v);
    }
  }
  out.props = props;
  out.events = events;
  out.children = rawChildren(node).map(toChild); // rule 3
  return out;
}

function rawChildren(node) {
  if (Array.isArray(node.children)) return node.children;
  if (node.child !== undefined && node.child !== null) return [node.child];
  if (Array.isArray(node.items)) return node.items; // reference semantics: items -> children
  return [];
}

function toChild(child) {
  if (typeof child === 'string') return buildNode({ type: 'text', data: child });
  return buildNode(child);
}

function normalizePropValue(key, value) {
  if (COLOR_KEY.test(key)) return normalizeColor(value);
  if (Array.isArray(value)) {
    return value.map((v) => (isPlainObject(v) ? normalizePropValue('*', v) : v));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizePropValue(k, v);
    return out;
  }
  return value;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// rule 7: nodeId = n<i>, depth-first pre-order, every node counted.
function assignNodeIds(node, counter) {
  node.nodeId = 'n' + counter.i++;
  for (const child of node.children) assignNodeIds(child, counter);
}
