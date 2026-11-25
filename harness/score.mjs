// Scoring — plan 1.4/1.5: weight per fixture = max weight of its categories;
// SKIP excluded from both sums.
export const LEVEL_WEIGHTS = { L0: 1, L1: 2, L2: 3, L3: 2, L4: 5, '3D-API': 2 };

export function weightFor(categories) {
  const known = (categories ?? []).map((c) => LEVEL_WEIGHTS[c]).filter((w) => w !== undefined);
  return known.length ? Math.max(...known) : 1; // unknown categories weight 1
}

// rows: [{ fixture, status: 'PASS'|'FAIL'|'SKIP', weight }]
export function scoreRows(rows) {
  let passed = 0, failed = 0, skipped = 0, passedWeight = 0, failedWeight = 0;
  for (const row of rows) {
    if (row.status === 'SKIP') { skipped++; continue; }
    if (row.status === 'PASS') { passed++; passedWeight += row.weight; }
    else { failed++; failedWeight += row.weight; }
  }
  const total = passedWeight + failedWeight;
  return {
    passed, failed, skipped,
    score: total > 0 ? passedWeight / total : null,
  };
}
