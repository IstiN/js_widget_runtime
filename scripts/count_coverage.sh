#!/usr/bin/env bash
# count_coverage.sh — prints the contract totals (nodes, props, event keys,
# channels, jsr members, fixtures per level) from docs/contract/inventory.json,
# docs/contract/jsr-api.md and docs/conformance/fixtures/.
# Exit 2 when a total cannot be computed.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "count_coverage: $1" >&2; exit 2; }

INV=docs/contract/inventory.json
API=docs/contract/jsr-api.md
FIX=docs/conformance/fixtures

[ -f "$INV" ] || fail "$INV missing (run scripts/gen_inventory.mjs)"
[ -f "$API" ] || fail "$API missing"

nodes=$(jq '.nodes | length' "$INV") || fail "cannot count nodes in $INV"
props=$(jq '[.nodes[].props | length] | add' "$INV") || fail "cannot count props in $INV"
events=$(jq '[.nodes[].events | length] | add' "$INV") || fail "cannot count event keys in $INV"

channels=$(grep -oE '__jsr_[a-z_0-9]+' "$API" | sort -u | wc -l | tr -d ' ')
[ "$channels" -gt 0 ] || fail "no channels found in $API"

members=$(grep -cE '^\| `jsr\.' "$API") || true
[ "$members" -gt 0 ] || fail "no jsr member rows found in $API"

[ -d "$FIX" ] || fail "$FIX missing"
levels=$(jq -rRn '
  ["L0","L1","L2","L3","L4","3D-API"] as $levels |
  (reduce inputs as $line ([0,0,0,0,0,0];
    . as $c |
    reduce ($levels | to_entries | map(select(.value as $l | $line | contains($l))) | .[].key) as $i
      ($c; .[$i] += 1))) as $c |
  reduce range(0; $levels | length) as $i (""; . + "\($levels[$i]): \($c[$i])  ")' < <(cat "$FIX"/*/expected.json 2>/dev/null))
fixtures=$(ls -d "$FIX"/*/ 2>/dev/null | wc -l | tr -d ' ')
[ "$fixtures" -gt 0 ] || fail "no fixtures under $FIX"

echo "nodes: $nodes"
echo "props: $props"
echo "event keys: $events"
echo "channels: $channels"
echo "jsr members: $members"
echo "fixtures: $fixtures  per level: $levels"
