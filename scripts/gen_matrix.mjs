#!/usr/bin/env node
// gen_matrix.mjs — validates docs/contract/matrix.json against
// docs/contract/inventory.json and generates docs/contract/matrix.md.
//
// matrix.json is the committed SOURCE of platform support statuses
// (node x prop x platform). Rows missing from it are filled with the start
// values of js_widget_runtime#1 (see scripts/lib/matrix_core.mjs). Wave D
// rewrites the final values from each platform's docs/node-support.json.
// Hand edits to matrix.json are preserved.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidPocTypes, applyPlatformSupport, fillMatrix, loadPlatformSupport } from './lib/matrix_core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = process.env.JSR_CONFORMANCE_DIR || join(root, '.conformance');
const outDir = join(root, 'docs', 'contract');
const inventory = JSON.parse(readFileSync(join(outDir, 'inventory.json'), 'utf8'));
const matrixPath = join(outDir, 'matrix.json');
const support = loadPlatformSupport(conf);
const lock = readFileSync(join(root, 'conformance.lock'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => l.split('@')[0]);
const matrix = {
  generatedFrom: {
    source: 'docs/contract/matrix.json',
    plan: 'js_widget_runtime#1',
    fillRule: 'scripts/lib/matrix_core.mjs (final values from the pinned docs/node-support.json)',
    pins: lock,
  },
  nodes: {},
};
fillMatrix(inventory, matrix, androidPocTypes(conf, new Set(inventory.nodes.map((n) => n.type))));
applyPlatformSupport(matrix, support, inventory.nodes.map((n) => n.type));

const rows = [];
const nodeMap = Object.fromEntries(inventory.nodes.map((n) => [n.type, n]));
for (const [type, node] of Object.entries(nodeMap)) {
  const m = matrix.nodes[type];
  for (const prop of Object.keys(node.props)) {
    const r = m.props[prop];
    rows.push(`| \`${type}\` | \`${prop}\` | ${r.flutter} | ${r.android} | ${r.ios} | ${r.macos} | ${r.web} |`);
  }
  const r = m.platforms;
  rows.push(`| \`${type}\` | *(node)* | ${r.flutter} | ${r.android} | ${r.ios} | ${r.macos} | ${r.web} |`);
}

writeFileSync(matrixPath, JSON.stringify(matrix, null, 2) + '\n');

const md = `# Node x prop support matrix

Source: \`docs/contract/matrix.json\` (generated). Values: \`yes\` / \`partial\` /
\`no\` / \`n/a\`. Flutter is the reference (all \`yes\` by definition). Node rows
carry the measured per-node status of each platform's pinned
\`docs/node-support.json\` (android: array rows; apple: \`rows[].status\` =
macOS, \`rows[].ios.status\` = iOS; react: \`nodes\` map = web). Prop rows:
flutter \`yes\`; other platforms \`n/a\` — no platform publishes per-prop
support data (see PR #4 for the mapping).

| Node | Prop | flutter | android | ios | macos | web |
|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
writeFileSync(join(outDir, 'matrix.md'), md);

const nodeCount = Object.keys(inventory.nodes).length;
console.log(
  `gen_matrix: ${nodeCount} nodes, ${rows.length - nodeCount} prop rows ` +
    `(+${nodeCount} node rows) -> docs/contract/matrix.md`,
);
