#!/usr/bin/env bash
# count_coverage.sh — prints the contract totals (nodes, props, event keys,
# node-event bindings, channels, jsr members, fixtures per level) from
# docs/contract/inventory.json, docs/contract/jsr-api.md, the js_runtime pin's
# docs/PROTOCOL.md and docs/conformance/fixtures/*/meta.json, then delegates
# the fixtures-coverage check to the harness (`harness.mjs coverage`).
# Exit 2 when a total cannot be computed or a coverage gap exists.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "count_coverage: $1" >&2; exit 2; }

INV=docs/contract/inventory.json
API=docs/contract/jsr-api.md
FIX=docs/conformance/fixtures
PROTOCOL="${JSR_CONFORMANCE_DIR:-.conformance}/js_runtime/docs/PROTOCOL.md"

[ -f "$INV" ] || fail "$INV missing (run scripts/gen_inventory.mjs)"
[ -f "$API" ] || fail "$API missing"

nodes=$(jq '.nodes | length' "$INV") || fail "cannot count nodes in $INV"
props=$(jq '[.nodes[].props | length] | add' "$INV") || fail "cannot count props in $INV"
event_keys=$(jq '[.nodes[].events | add?] | add | length' "$INV") || fail "cannot count unique event keys in $INV"
bindings=$(jq '[.nodes[].events | length] | add' "$INV") || fail "cannot count event bindings in $INV"

# Channels: the bridge channels declared by the js_runtime pin's PROTOCOL.md
# (the main channel table rows, each carrying its wire example), and the
# subset the jsr members of jsr-api.md use.
if [ -f "$PROTOCOL" ]; then
  channels_protocol=$(grep -cE '^\| `__jsr_[a-z_0-9]+`.*sendMessage\(' "$PROTOCOL") || channels_protocol=0
else
  channels_protocol="n/a (fetch pin)"
fi
channels_members=$(grep -oE '__jsr_[a-z_0-9]+' "$API" | sort -u | wc -l | tr -d ' ')
[ "$channels_members" -gt 0 ] || fail "no channels found in $API"

members=$(grep -cE '^\| `jsr\.' "$API") || true
[ "$members" -gt 0 ] || fail "no jsr member rows found in $API"

[ -d "$FIX" ] || fail "$FIX missing"
levels=$(jq -rRn '
  ["L0","L1","L2","L3","L4","3D-API"] as $levels |
  (reduce inputs as $line ([0,0,0,0,0,0];
    . as $c |
    reduce ($levels | to_entries | map(select(.value as $l | $line | contains($l))) | .[].key) as $i
      ($c; .[$i] += 1))) as $c |
  reduce range(0; $levels | length) as $i (""; . + "\($levels[$i]): \($c[$i])  ")' \
  < <(cat "$FIX"/*/meta.json 2>/dev/null))
fixtures=$(ls -d "$FIX"/*/ 2>/dev/null | wc -l | tr -d ' ')
[ "$fixtures" -gt 0 ] || fail "no fixtures under $FIX"

echo "nodes: $nodes"
echo "props: $props"
echo "event keys (unique): $event_keys"
echo "node-event bindings: $bindings"
echo "channels (PROTOCOL.md of the js_runtime pin): $channels_protocol"
echo "channels (used by jsr members in jsr-api.md): $channels_members"
echo "jsr members: $members"
echo "fixtures: $fixtures  per level (meta.json.categories): $levels"

# Fixtures-coverage check (plan 1.5): every inventory node type and every
# event key must occur in at least one widget.js. Exit 2 on a gap.
exec node harness/harness.mjs coverage "$@"
