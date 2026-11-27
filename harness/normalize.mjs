// AUI normalization — plan 1.3 rules 1..7, one implementation for the family.
import { resolveTypeAlias } from './aliases.mjs';

const STRUCTURAL = new Set(['type', 'child', 'children', 'items', 'key', 'style', 'props', 'events', 'nodeId', '__iid']);
const COLOR_KEY = /color/i;

// Colors become `#RRGGBB` or `#RRGGBBAA` with upper-case hex (plan 1.3 rule 6).
// Named CSS colors are out of contract: fixtures use hex/rgb() only.
export function normalizeColor(value) {
  if (typeof value !== 'string') return value;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (hex) return hexColor(hex[1], value);
  const rgb = /^rgba?\(\s*([^)]+?)\s*\)$/i.exec(value.trim());
  if (rgb) return rgbColor(rgb[1], value);
  return value;
}

function hexColor(h, original) {
  if (h.length === 3 || h.length === 4) {
    return '#' + [...h].map((c) => c + c).join('').toUpperCase();
  }
  if (h.length === 6 || h.length === 8) return '#' + h.toUpperCase();
  return original;
}

const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));

function byteHex(n) {
  return clampByte(n).toString(16).padStart(2, '0');
}

// ponytail: alpha > 1 read as 0-255 scale
function alphaHex(v) {
  const alpha = v > 1 ? v / 255 : v;
  return clampByte(Math.round(alpha * 255)).toString(16).padStart(2, '0').toUpperCase();
}

function rgbColor(numsText, original) {
  const nums = numsText.split(/[\s,+/]+/).map(Number).filter((n) => !Number.isNaN(n));
  if (nums.length !== 3 && nums.length !== 4) return original;
  let out = '#' + nums.slice(0, 3).map(byteHex).join('').toUpperCase();
  if (nums.length === 4) out += alphaHex(nums[3]);
  return out;
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
  // working map: top-level keys, already-normalized props merged in first so
  // the alias rules see the same view for raw payloads and dumps (idempotent)
  const working = workingMap(node);
  working.type = resolveTypeAlias(working.type);
  applyFieldAliases(working); // reference UiViewTreeNormalizer._aliasFields

  const out = { type: working.type };
  const events = isPlainObject(working.events) ? { ...working.events } : {};
  const props = collectProps(working, events);
  mergeStyleProps(node, props, events); // rule 1: node keys win over style keys
  out.props = props;
  out.events = events;
  out.children = rawChildren(working).map(toChild); // rule 3
  return out;
}

function workingMap(node) {
  const working = {};
  if (isPlainObject(node.props)) {
    for (const [k, v] of Object.entries(node.props)) working[k] = v;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k !== 'props' && !(k in working)) working[k] = v; // node keys win
  }
  return working;
}

// rules 2 and 6: string `on*` values move to events; values normalize.
function collectProps(working, events) {
  const props = {};
  for (const [k, v] of Object.entries(working)) {
    if (STRUCTURAL.has(k) || k === 'events') continue;
    if (/^on[A-Z]/.test(k) && typeof v === 'string') { events[k] = v; continue; } // rule 2
    props[k] = normalizePropValue(k, v); // rule 6
  }
  return props;
}

function mergeStyleProps(node, props, events) {
  if (!isPlainObject(node.style)) return;
  for (const [k, v] of Object.entries(node.style)) {
    if (!(k in props) && !(k in events)) props[k] = normalizePropValue(k, v);
  }
}

// Field aliases copied from the reference normalizer (ui_view_tree_normalizer.dart @ 1fa2ec41):
// an alias applies only when its target prop is absent, so a dump that
// already carries both props stays unchanged.
const BOX_TYPES = new Set(['container', 'card', 'animatedContainer']);
const BUTTON_TYPES = new Set(['button', 'textButton', 'outlinedButton']);
const INPUT_TYPES = new Set(['textField', 'input', 'textArea']);
const IMAGE_TYPES = new Set(['image', 'networkImage', 'img']);
const VALUE_TYPES = new Set(['switch', 'checkbox', 'slider']);

const SVG_TYPES = new Set(['svg']);
const DROPDOWN_TYPES = new Set(['dropdown', 'select']);

// Reference UiViewTreeNormalizer._aliasFields as a type-family table; an
// alias applies only when its target prop is absent (see the alias helpers).
const ALIAS_FAMILIES = [
  [BOX_TYPES, aliasBoxDecoration],
  [BUTTON_TYPES, (out) => aliasButtonLabel(out)],
  [INPUT_TYPES, aliasInputFields],
  [IMAGE_TYPES, aliasImageSource],
  [SVG_TYPES, aliasSvgMarkup],
  [VALUE_TYPES, aliasOnChanged],
  [DROPDOWN_TYPES, aliasDropdown],
];

function applyFieldAliases(out) {
  aliasTextContent(out);
  for (const [types, rule] of ALIAS_FAMILIES) {
    if (types.has(out.type)) rule(out, out.type);
  }
}

function aliasTextContent(out) {
  if (out.content != null && out.data == null) {
    out.data = out.content;
    delete out.content;
  }
  if (out.label != null && out.data == null && out.type === 'text') {
    out.data = out.label; // reference keeps the label prop
  }
}

function aliasBoxDecoration(out, type) {
  if (out.backgroundColor != null && out.decoration == null) {
    out.decoration = { color: out.backgroundColor };
    delete out.backgroundColor;
  }
  if (out.color != null && out.decoration == null && type === 'container') {
    out.decoration = { color: out.color };
    delete out.color;
  }
}

function aliasButtonLabel(out) {
  if (out.title != null && out.data == null) {
    out.data = out.title;
    delete out.title;
  }
  if (out.text != null && out.data == null) {
    out.data = out.text;
    delete out.text;
  }
}

function aliasInputFields(out, type) {
  out.type = type === 'textArea' ? 'textArea' : 'textField';
  if (out.placeholder != null && out.hint == null) {
    out.hint = out.placeholder;
    delete out.placeholder;
  }
  if (out.value != null && out.initialValue == null) {
    out.initialValue = out.value;
    delete out.value;
  }
  aliasOnChanged(out);
}

function aliasImageSource(out) {
  out.type = 'image';
  if (out.uri != null && out.url == null) {
    out.url = out.uri;
    delete out.uri;
  }
  if (out.source != null && out.url == null) {
    out.url = out.source;
    delete out.source;
  }
}

function aliasSvgMarkup(out) {
  if (out.markup != null && out.data == null) {
    out.data = out.markup;
    delete out.markup;
  }
}

function aliasOnChanged(out) {
  if (out.onChanged != null && out.onChange == null) {
    out.onChange = out.onChanged;
    delete out.onChanged;
  }
}

function aliasDropdown(out) {
  out.type = 'dropdown';
  aliasOnChanged(out);
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

// A3: the scroll-state contract applies to the resolved type `scroll`
// (`ScrollView`, `scrollView`, `SingleChildScrollView`, ... aliases resolve
// to it). A normalized dump node of this type carries `scrollOffset`,
// `scrollExtent`, `viewportExtent` (numbers, logical px, primary axis);
// normalization passes them through unchanged and idempotently.
export function isScrollableType(type) {
  return resolveTypeAlias(type) === 'scroll';
}
