#!/usr/bin/env node
// gen_inventory.mjs — generates docs/contract/inventory.json and
// docs/contract/nodes/<type>.md from the pinned flutter_js_widget_runtime
// renderer (contract side of js_widget_runtime#1).
//
// Reads the pinned sources under .conformance/flutter_js_widget_runtime
// (JSR_CONFORMANCE_DIR overrides the conformance directory root):
//   - lib/src/renderer/json_widget_renderer.dart  (_nodeBuilders map)
//   - lib/src/renderer/**/*.dart                 (builder bodies, helpers)
//   - lib/src/renderer/ui_view_tree_normalizer.dart (type alias table)
// Hand-verified facts that the script cannot derive from Dart live in
// docs/contract/inventory.manual.json and are merged over the extraction,
// so a regeneration never loses them.
//
// Requires docs/contract/matrix.json (run scripts/gen_matrix.mjs first).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = process.env.JSR_CONFORMANCE_DIR || join(root, '.conformance');
const flutterDir = join(conf, 'flutter_js_widget_runtime');
const flutterSha = readFileSync(join(root, 'conformance.lock'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('IstiN/flutter_js_widget_runtime@'))[0]
  .match(/@([0-9a-f]{40})/)[1];
const outDir = join(root, 'docs', 'contract');
const nodesDir = join(outDir, 'nodes');

// ── Dart source loading ──────────────────────────────────────────────────────

function listDart(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listDart(p));
    else if (e.name.endsWith('.dart')) out.push(p);
  }
  return out;
}

const rendererFiles = listDart(join(flutterDir, 'lib', 'src', 'renderer'));
const sources = rendererFiles.map((p) => ({
  rel: relative(join(flutterDir), p),
  text: readFileSync(p, 'utf8'),
}));

// Every function/method definition in the renderer sources with its body.
// Method bodies inside extensions are matched by name; the renderer has no
// duplicate definition names (each builder/helper name is defined once).
const defs = new Map(); // name -> { rel, line, body }
const DEF_RE =
  /(?:@[\w.]+\s+)*(?:[\w<>?,. ]+\s+)?(_?\w+)\s*(?:<[^()]*>)?\(((?:[^()]|\([^()]*\))*)\)\s*(?:async\s*)?(\{|=>)/g;
const RESERVED = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'function']);
for (const src of sources) {
  const text = src.text;
  // Line number helper: 1 + count of newlines before an index.
  const lineAt = (idx) => 1 + (text.slice(0, idx).match(/\n/g) || []).length;
  DEF_RE.lastIndex = 0;
  let m;
  while ((m = DEF_RE.exec(text))) {
    const name = m[1];
    if (RESERVED.has(name)) continue;
    if (defs.has(name)) continue; // first definition wins
    const bodyStart = m.index + m[0].length;
    let body;
    if (m[3] === '=>') {
      // Expression body: to the first `;` at paren depth 0 (relative scan).
      let i = bodyStart, depth = 0;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ';' && depth <= 0) break;
      }
      body = text.slice(bodyStart, i + 1);
    } else {
      // Block body: the opening `{` was consumed by the match; count from 1.
      let i = bodyStart, depth = 1;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth === 0) break;
      }
      body = text.slice(bodyStart, i); // excludes the outer braces
    }
    defs.set(name, { rel: src.rel, line: lineAt(m.index), body });
  }
}

function sourceUrl(rel, line) {
  return `https://github.com/IstiN/flutter_js_widget_runtime/blob/${flutterSha}/${rel}#L${line}`;
}

// ── Prop classification ──────────────────────────────────────────────────────

// Pattern table: helper calls that classify a prop (or a local holding one).
// `§` is the target placeholder: the m['key'] access for direct passes, or
// any identifier when classifying a local's usage. Literals are Dart.
const num = (s) => (s === null ? null : Number(s));
const RAW = [
  [/_double\(\s*§\s*,\s*(-?[\d.]+)\s*\)/, () => 'number', (m) => num(m[1])],
  [/_doubleOrNull\(\s*§\s*\)/, () => 'number', () => null],
  [/jsDouble\(\s*§\s*,\s*(-?[\d.]+)\s*\)/, () => 'number', (m) => num(m[1])],
  [/jsDoubleOrNull\(\s*§\s*\)/, () => 'number', () => null],
  [/jsBool\(\s*§\s*,\s*(true|false)\s*\)/, () => 'boolean', (m) => m[1] === 'true'],
  [/jsBool\(\s*§\s*\)/, () => 'boolean', () => false],
  [/jsCurve\(\s*§\s*\)/, () => 'curve', () => 'linear'],
  [/_int\(\s*§\s*,\s*(-?\d+)\s*\)/, () => 'integer', (m) => num(m[1])],
  [/_durationMs\(\s*§\s*,\s*(-?\d+)\s*\)/, () => 'integer (ms)', (m) => num(m[1])],
  [/_color\(\s*§/, () => 'color', () => null],
  [/_edgeInsets(?:OrNull)?\(\s*§\s*\)/, () => 'number|number[4]|object', () => null],
  [/_alignment\(\s*§\s*\)/, () => 'alignment', () => 'center'],
  [/_mainAxis\(\s*§\s*\)/, () => 'enum(min|center|end|spaceBetween|spaceAround|spaceEvenly)', () => 'min'],
  [/_crossAxis\(\s*§\s*\)/, () => 'enum(min|max|center|baseline|stretch)', () => 'min'],
  [/_mainSize\(\s*§\s*\)/, () => 'enum(min|max)', () => 'max'],
  [/_boxFit\(\s*§\s*\)/, () => 'enum(fill|contain|cover|fitWidth|fitHeight|none)', () => 'cover'],
  [/_curve\(\s*§\s*\)/, () => 'curve', () => 'linear'],
  [/_overflow\(\s*§\s*\)/, () => 'enum(clip|ellipsis|fade|visible)', () => 'clip'],
  [/_gradient\(\s*§/, () => 'gradient', () => null],
  [/_matrix4\(\s*§\s*\)/, () => 'matrix', () => null],
  [/_iconData\(\s*§\s*\)/, () => 'iconName', () => 'widgets'],
  [/_textStyle\(\s*§\s*\)/, () => 'style', () => null],
  [/_variant\(\s*§/, () => 'string', () => null],
  [/_textShadows\(\s*§/, () => 'shadow[] ({color, blur, offsetX, offsetY})', () => null],
  [/jsBorderRadius\(\s*§\s*\)\s*\?\?\s*BorderRadius\.circular\(([\d.]+)\)/, () => 'number|number[4]', (m) => num(m[1])],
  [/jsBorderRadius\(\s*§\s*\)/, () => 'number|number[4]', () => null],
  [/_scrollPhysics\(\s*§\s*,/, () => 'enum(never|always|bounce|clamping)', () => 'alwaysScrollable'],
  [/_boxShadows\(\s*§/, () => 'shadow[] ({color, blur, spread, offsetX, offsetY})', () => null],
];
const compile = (t) => RAW.map(([re, ty, df]) => [new RegExp(re.source.replaceAll('§', t)), ty, df]);
const PATTERNS_M = compile("m\\['[^']+'\\]");
const PATTERNS_ID = compile("[A-Za-z_]\\w*");

function classifyAccess(ctx, accessKey, allowIdentifier = false) {
  // ctx: text around the access (the enclosing call or the line).
  for (const [re, type, def] of PATTERNS_M) {
    const m = ctx.match(re);
    if (m) return { type: type(), default: def(m) };
  }
  if (allowIdentifier) {
    for (const [re, type, def] of PATTERNS_ID) {
      const m = ctx.match(re);
      if (m) return { type: type(), default: def(m) };
    }
  }
  // m['k'] ?? <literal> (with optional intermediate `?? m['other']` chains).
  const CHAIN = "(?:\\s*\\?\\?\\s*m\\['[^']+'\\])*";
  let m = ctx.match(new RegExp(`m\\['[^']+'\\]${CHAIN}\\s*\\?\\?\\s*(?:const\\s+)?(-?\\d+(?:\\.\\d+)?)\\b`));
  if (m) return { type: 'number', default: num(m[1]) };
  m = ctx.match(new RegExp(`m\\['[^']+'\\]${CHAIN}\\s*\\?\\?\\s*(?:const\\s+)?'([^']*)'`));
  if (m) return { type: 'string', default: m[1] };
  m = ctx.match(new RegExp(`m\\['[^']+'\\]${CHAIN}\\s*\\?\\?\\s*(true|false)`));
  if (m) return { type: 'boolean', default: m[1] === 'true' };
  m = ctx.match(new RegExp(`m\\['[^']+'\\]${CHAIN}\\s*\\?\\?\\s*(?:const\\s+)?\\[`));
  if (m) return { type: 'array', default: null };
  // casts (with optional `?? m['other']` chains before the cast and a
  // literal fallback after it)
  m = ctx.match(new RegExp(`m\\['[^']+'\\]${CHAIN}\\s+as\\s+(String|int|num|double|bool|Map|List)(\\?)?(?:\\s*\\?\\?\\s*(?:const\\s+)?(-?\\d+(?:\\.\\d+)?|true|false|'[^']*'|\\[))?`));
  if (m) {
    const kind = { String: 'string', int: 'integer', num: 'number', double: 'number', bool: 'boolean', Map: 'object', List: 'array' }[m[1]];
    let def = m[2] ? null : 'required';
    if (m[3] !== undefined) def = m[3] === 'true' ? true : m[3] === 'false' ? false : (m[3].startsWith("'") || m[3].startsWith('[') ? null : num(m[3]));
    return { type: kind, default: def };
  }
  // boolean probes / enum probes / map probes / switch dispatch
  if (/m\['[^']+'\]\s*==\s*true/.test(ctx)) return { type: 'boolean', default: false };
  m = ctx.match(/m\['[^']+'\]\s*==\s*'([^']*)'/);
  if (m) return { type: 'string', default: null };
  if (/m\['[^']+'\]\s+is\s+Map/.test(ctx)) return { type: 'object', default: null };
  if (/switch\s*\(\s*m\['[^']+'\]\s*\)/.test(ctx)) return { type: 'string', default: null };
  // Events and their companions.
  if (/^on[A-Z]/.test(accessKey)) return { type: 'string (action id)', default: null };
  if (/^(action|actionId)$/.test(accessKey)) return { type: 'string (action id)', default: null };
  if (accessKey === 'payload') return { type: 'object', default: null };
  // Plain pass-through access: the renderer forwards the raw JSON value.
  return { type: 'any', default: null };
}

const IDENT = /([A-Za-z_][\w]*(?:\?[.\w]*)*)\s*\(\s*m\s*[,)]/g;

// Recursively scans a builder body for prop accesses and child helpers.
function scanBody(def, depth, seen, acc, nodeType = '?') {
  if (depth > 4 || seen.has(def)) return;
  seen.add(def);
  const body = def.body;
  // Direct m['key'] accesses with context: the containing expression —
  // from the nearest line start or `(` before the access to the nearest
  // line end or `)` after it (single-argument call sites).
  const re = /m\['([^']+)'\]/g;
  let m;
  while ((m = re.exec(body))) {
    const key = m[1];
    // Context = the enclosing call expression (balanced parens), which
    // spans the multi-line helper calls the builders use; fall back to the
    // containing line for bare assignments.
    let start = -1, depth = 0;
    for (let i = m.index; i >= 0; i--) {
      const ch = body[i];
      if (ch === ')') depth++;
      else if (ch === '(') {
        if (depth === 0) { start = i; break; }
        depth--;
      }
    }
    let ctx;
    if (start !== -1) {
      let d = 0, j = m.index;
      for (; j < body.length; j++) {
        const ch = body[j];
        if (ch === '(') d++;
        else if (ch === ')') { d--; if (d === 0) break; }
      }
      ctx = body.slice(start, j + 1);
    } else {
      let a = m.index, b = m.index + m[0].length;
      while (a > 0 && body[a - 1] !== '\n') a--;
      while (b < body.length && body[b] !== '\n') b++;
      ctx = body.slice(a, b);
    }
    const styleSub = ctx.match(/\(m\['style'\] as Map\?\)\?\['([^']+)'\]/);
    if (styleSub && styleSub[1] === key) {
      const seg = ctx.slice(ctx.indexOf(styleSub[0]));
      const cast = seg.match(/as\s+(String|int|num|double|bool|Map|List)(\?)?/);
      const lit = seg.match(/\?\?\s*(?:const\s+)?(-?\d+(?:\.\d+)?|'[^']*'|true|false)/);
      const c = cast
        ? { type: { String: 'string', int: 'integer', num: 'number', double: 'number', bool: 'boolean', Map: 'object', List: 'array' }[cast[1]], default: cast[2] ? null : lit ? lit[1] : 'required' }
        : classifyAccess(ctx, key);
      recordProp(acc, 'style.' + key, c, def);
      continue;
    }
    const c = classifyAccess(ctx, key);
    recordProp(acc, key, c, def);
  }
  // Style sub-props read inside the shared _textStyle helper.
  if (/_textStyle\(/.test(body)) {
    const styleDef = defs.get('_textStyle');
    if (styleDef && !seen.has(styleDef)) {
      seen.add(styleDef);
      for (const sm of styleDef.body.matchAll(/[\w]+\??\['([a-zA-Z]+)'\]/g)) {
        const skey = sm[1];
        const sa = sm.index, sb = sm.index + sm[0].length;
        let pa = sa, pb = sb;
        while (pa > 0 && !/[\n(]/.test(styleDef.body[pa - 1])) pa--;
        while (pb < styleDef.body.length && !/[\n)]/.test(styleDef.body[pb])) pb++;
        recordProp(acc, 'style.' + skey, classifyAccess(styleDef.body.slice(pa, pb), skey), styleDef);
      }
    }
  }
  // m[kSomeConst] — resolve const string values.
  for (const cm of body.matchAll(/m\[(k[A-Za-z]+)\]/g)) {
    const cname = cm[1];
    for (const src of sources) {
      const lm = src.text.match(new RegExp(`const ${cname}\\s*=\\s*'([^']*)'`));
      if (lm) { recordProp(acc, lm[1], { type: 'boolean', default: false }, def); break; }
    }
  }
  // Locals assigned from a plain prop access: classify by their usage call
  // (`final radius = m['radius']; ... jsBorderRadius(radius)`).
  for (const am of body.matchAll(/(?:final|var)\s+(\w+)\s*=\s*([^;]*m\['([^']+)'\][^;]*);/g)) {
    const [, local, expr, key] = am;
    if (classifyAccess(expr, key).type !== 'any') continue; // direct pass handled it
    const usage = new RegExp(`([A-Za-z_][\\w]*)\\(\\s*${local}\\b`);
    const um = body.match(usage);
    if (!um) continue;
    const open = body.indexOf('(', um.index);
    let d = 0, j = open;
    for (; j < body.length; j++) {
      if (body[j] === '(') d++;
      else if (body[j] === ')') { d--; if (d === 0) break; }
    }
    const callText = body.slice(um.index, j + 1);
    const c = classifyAccess(callText, key, true);
    if (c.type !== 'any') recordProp(acc, key, c, def);
  }
  // Child helpers.
  if (/_children\(\s*m\s*\)/.test(body)) acc.children = 'children: array of nodes';
  if (/_child\(\s*m\s*\)/.test(body)) acc.children ||= 'child: single node';
  if (/\bitems\b/.test(body) && acc.children === undefined) acc.itemsHint = true;
  // Recurse into helpers that receive `m`.
  for (const hm of body.matchAll(IDENT)) {
    const name = hm[1];
    const helper = defs.get(name);
    if (helper) scanBody(helper, depth + 1, seen, acc);
  }
}

function recordProp(acc, key, c, def) {
  if (['style', 'type', 'child', 'children', 'key'].includes(key)) return;
  const p = acc.props[key] || (acc.props[key] = {});
  if (c && c.type) p.type = p.type || c.type;
  if (c && 'default' in c && c.default !== undefined && !('default' in p)) p.default = c.default;
  if (!p.source) p.source = { file: def.rel, line: def.line };
  if (/^on[A-Z]/.test(key) && !acc.events.includes(key)) acc.events.push(key);
}

// ── _nodeBuilders map ────────────────────────────────────────────────────────

const rendererSrc = sources.find((s) => s.rel.endsWith('json_widget_renderer.dart'));
const rendererLines = rendererSrc.text.split('\n');
const mapStart = rendererLines.findIndex((l) => l.includes('_nodeBuilders ='));
if (mapStart === -1) throw new Error('_nodeBuilders map not found');
let mapEnd = mapStart;
while (rendererLines[mapEnd] && !rendererLines[mapEnd].trim().startsWith('};')) mapEnd++;

const entries = []; // { type, builder, category }
let category = 'core';
for (let i = mapStart; i <= mapEnd; i++) {
  const line = rendererLines[i];
  const cm = line.match(/^\s*\/\/\s*(.+?)\s*$/);
  if (cm && !cm[1].startsWith('`')) { category = cm[1].replace(/^New nodes$/, 'new'); continue; }
  const em = line.match(/'([^']+)':\s*(_?\w+)|'([^']+)':\s*\(m\)\s*=>\s*(\w+)\(/);
  if (em) {
    const type = em[1] || em[3];
    let builder = em[2] || em[4];
    // `(m) => buildJsPathNode(m, extra)` keeps the builder function name.
    entries.push({ type, builder, category });
  }
}

// ── Manual data ──────────────────────────────────────────────────────────────

const manual = JSON.parse(readFileSync(join(outDir, 'inventory.manual.json'), 'utf8'));
const universalEffects = manual.universalEffects;
const keyProp = manual.keyProp;
const globalProps = manual.globalProps || {};

// ── Per-node extraction ──────────────────────────────────────────────────────

const nodes = {};
let anyCount = 0;
for (const e of entries) {
  const manualNode = manual.nodes[e.type] || {};
  const acc = { props: {}, events: [], children: undefined };
  const def = defs.get(e.builder);
  if (!def) throw new Error(`builder ${e.builder} of node ${e.type} not found`);
  scanBody(def, 0, new Set(), acc);
  // Manual prop overrides/merges.
  for (const [name, over] of Object.entries(manualNode.props || {})) {
    acc.props[name] = { ...acc.props[name], ...over };
  }
  for (const [name, over] of Object.entries(globalProps)) {
    if (acc.props[name]) acc.props[name] = { ...acc.props[name], ...over };
  }
  const props = {};
  const propTypes = manual.propTypes || {};
  for (const [name, p] of Object.entries(acc.props)) {
    const sorted = { type: p.type ?? null, default: p.default ?? null };
    if (p.source) sorted.source = { file: p.source.file, line: p.source.line };
    if (p.effect) sorted.effect = p.effect;
    if (p.note) sorted.note = p.note;
    // Hand-verified semantics for pass-through props (inventory.manual.json
    // propTypes), applied where the static extraction fell through to "any".
    // For style sub-props (`style.fontSize`) the bare name is looked up too.
    const known = propTypes[name] || (name.startsWith('style.') ? propTypes[name.slice('style.'.length)] : undefined);
    if (known && (sorted.type === 'any' || sorted.type === null)) {
      sorted.type = known.type;
      if (known.default !== undefined) sorted.default = known.default;
      if (known.note) sorted.note = sorted.note ? `${sorted.note} ${known.note}` : known.note;
    }
    props[name] = sorted;
    if (sorted.type === 'any') anyCount++;
    // Every prop can carry the universal effects; the effect column is filled
    // from the universal table or a manual override.
    if (!sorted.effect && universalEffects[name]) sorted.effect = universalEffects[name].effect;
  }
  // Universal props apply to every node; list them after the node's own props.
  for (const [name, u] of Object.entries(universalEffects)) {
    if (!props[name]) {
      props[name] = { type: u.type, default: u.default, effect: u.effect, universal: true, source: { file: u.source.file, line: u.source.line } };
    }
  }
  // The universal identity hint is documented once per page (jsr-api.md carries the contract).
  const category = manualNode.category || (e.category === 'core' ? categoryOf(e.type) : e.category);
  nodes[e.type] = {
    category,
    builder: e.builder,
    source: { file: def.rel, line: def.line, url: sourceUrl(def.rel, def.line) },
    children: manualNode.children || acc.children || 'none',
    events: acc.events.length ? acc.events : (manualNode.events || []),
    props,
    notes: manualNode.notes || '',
    aliasesIn: entries.filter((x) => x.builder === e.builder && x.type !== e.type).map((x) => x.type),
  };
}

function categoryOf(type) {
  const g = manual.categoryGroups || {};
  for (const [cat, types] of Object.entries(g)) if (types.includes(type)) return cat;
  return 'layout';
}

// ── Alias table ──────────────────────────────────────────────────────────────

const normSrc = sources.find((s) => s.rel.endsWith('ui_view_tree_normalizer.dart'));
const aliasBlock = normSrc.text.match(/_typeAliases = <String, String>\{([\s\S]*?)\n  \};/)[1];
const aliases = {};
for (const am of aliasBlock.matchAll(/'([^']+)':\s*'([^']+)'/g)) aliases[am[1]] = am[2];

// ── Emission ─────────────────────────────────────────────────────────────────

const inventory = {
  generatedFrom: {
    repo: 'IstiN/flutter_js_widget_runtime',
    sha: flutterSha,
    renderer: 'lib/src/renderer/json_widget_renderer.dart',
    buildersLine: mapStart + 1,
    generator: 'scripts/gen_inventory.mjs',
    manualFacts: 'docs/contract/inventory.manual.json',
  },
  // `nodes` is an array in _nodeBuilders registration order; every entry
  // carries `type` (the key of _nodeBuilders) and `events` (event keys of
  // the node type) — the fields the conformance harness `coverage` command
  // consumes. The rest is per-node contract data (category, builder source
  // link, props, children rule, notes).
  keyProp,
  universalEffects,
  aliases,
  nodes: Object.entries(nodes).map(([type, n]) => ({ type, ...n })),
};

const matrixPath = join(outDir, 'matrix.json');
let matrix;
try {
  matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
} catch {
  // First run: gen_matrix.mjs has not produced matrix.json yet — build it
  // from the start values (scripts/lib/matrix_core.mjs) so this script can
  // render the support lines. Hand values are never touched here.
  const { androidPocTypes, fillMatrix } = await import('./lib/matrix_core.mjs');
  matrix = { generatedFrom: { source: 'docs/contract/matrix.json', plan: 'js_widget_runtime#1' }, nodes: {} };
  fillMatrix(inventory, matrix, androidPocTypes(conf, new Set(inventory.nodes.map((n) => n.type))));
  console.error('gen_inventory: matrix.json was missing — wrote start values (run scripts/gen_matrix.mjs for matrix.md)');
  writeFileSync(matrixPath, JSON.stringify(matrix, null, 2) + '\n');
}

mkdirSync(nodesDir, { recursive: true });
writeFileSync(join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');

for (const [type, n] of Object.entries(nodes)) {
  const rows = Object.entries(n.props)
    .map(([name, p]) => {
      const def = p.default === null ? 'null' : JSON.stringify(p.default);
      const src = `[${p.source.file.split('/').pop()}:${p.source.line}](${p.source ? sourceUrl(p.source.file, p.source.line) : ''})`;
      return `| \`${name}\` | ${p.type ?? 'unverified'} | ${def} | ${p.effect || '—'} | ${src} |`;
    })
    .join('\n');
  const support = matrix.nodes[type]
    ? Object.entries(matrix.nodes[type].platforms).map(([p, v]) => `${p}=${v}`).join(', ')
    : 'MISSING IN matrix.json';
  const md = `# \`${type}\`

Category: **${n.category}**${n.aliasesIn.length ? ` · also registered as: ${n.aliasesIn.map((a) => `\`${a}\``).join(', ')}` : ''}

Builder: \`${n.builder}\` — [source](${n.source.url}).

${n.notes}

## Props

| Name | Type | Default | Effect | Source |
|---|---|---|---|---|
${rows || '| — | — | — | — | — |'}

Universal effect props (applied to every node by \`_applyUniversalEffects\`) are
included above and marked by their effect column; the universal identity hint
\`key\` is documented in [jsr-api.md](../jsr-api.md).

## Events

${n.events.length ? n.events.map((e) => `- \`${e}\` — action id string, delivered through \`jsr.onEvent\``).join('\n') : '- none'}

## Children

${n.children}

## Platform support

${support} (source: [matrix.md](../matrix.md); wave D fills the final values).
`;
  writeFileSync(join(nodesDir, `${type}.md`), md);
}

console.log(
  `gen_inventory: ${Object.keys(nodes).length} nodes, ` +
    `${Object.values(nodes).reduce((a, n) => a + Object.keys(n.props).length, 0)} prop rows, ` +
    `${Object.values(nodes).reduce((a, n) => a + n.events.length, 0)} event keys ` +
    `(${anyCount} pass-through "any" props) -> docs/contract/inventory.json + docs/contract/nodes/`,
);
