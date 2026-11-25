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
import { androidPocTypes, fillMatrix } from './lib/matrix_core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conf = process.env.JSR_CONFORMANCE_DIR || join(root, '.conformance');
const outDir = join(root, 'docs', 'contract');
const inventory = JSON.parse(readFileSync(join(outDir, 'inventory.json'), 'utf8'));
const matrixPath = join(outDir, 'matrix.json');
const matrix = {
  generatedFrom: {
    source: 'docs/contract/matrix.json',
    plan: 'js_widget_runtime#1',
    fillRule: 'scripts/lib/matrix_core.mjs (wave D rewrites from platform node-support.json)',
  },
  nodes: {},
};
fillMatrix(inventory, matrix, androidPocTypes(conf, new Set(inventory.nodes.map((n) => n.type))));

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

Source: \`docs/contract/matrix.json\` (committed; regeneration fills only
missing rows — hand edits are preserved). Values: \`yes\` / \`partial\` /
\`no\` / \`n/a\`. Flutter is the reference (all \`yes\` by definition). Android
start values come from the android_js_widget_runtime POC renderer. Wave D
fills the final values from each platform's \`docs/node-support.json\`.

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
