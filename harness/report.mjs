// Markdown report and badge JSON — plan 1.5.
import { scoreRows } from './score.mjs';

// rows: [{ fixture, level, status: 'PASS'|'FAIL'|'SKIP', diffs }]
export function renderReport({ platform, rows, generatedAt = new Date().toISOString() }) {
  const scored = scoreRows(rows);
  const lines = [
    `# Conformance report`,
    '',
    `Platform: ${platform ?? 'unknown'} · generated ${generatedAt}`,
    '',
    '| Fixture | Level | Status | Diffs |',
    '|---|---|---|---|',
  ];
  for (const row of rows) {
    const diffCell = row.diffs.length === 0 ? '-' : `${row.diffs.length} (${row.diffs[0].path})`;
    lines.push(`| ${row.fixture} | ${row.level} | ${row.status} | ${diffCell} |`);
  }
  const score = scored.score === null ? 'n/a' : `${Math.round(scored.score * 100)}%`;
  lines.push('');
  lines.push(`Score: ${score} (passed ${scored.passed}, failed ${scored.failed}, skipped ${scored.skipped})`);
  return lines.join('\n') + '\n';
}

export function renderBadge({ platform, rows, generatedAt = new Date().toISOString() }) {
  const { score, passed, failed, skipped } = scoreRows(rows);
  return {
    platform: platform ?? 'unknown',
    score: score === null ? null : Math.round(score * 100),
    passed, failed, skipped,
    generatedAt,
  };
}
