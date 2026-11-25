#!/usr/bin/env bash
# run_reference.sh — runs the pinned flutter_js_widget_runtime reference
# runner (F1 conformance kit) over the fixtures of THIS repository.
# One entry point for every fixture lane and for CI.
#
# usage:
#   scripts/run_reference.sh --fixtures <dir> --out <dir> [--filter <glob>]
#
# Checkout prep (per docs/conformance.md of the pin, once per pin state):
#   flutter pub get, then the QuickJS bridge (built in the pub-cache
#   quickjs_runtime-* package and copied where lib/ of the pin loads it on
#   macOS). The bridge path under native/quickjs/ is gitignored, so the
#   checkout's tracked files are never edited. The runner's exit code is
#   this script's exit code.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
conf="${JSR_CONFORMANCE_DIR:-$root/.conformance}"
flutter_dir="$conf/flutter_js_widget_runtime"
[ -d "$flutter_dir" ] || { echo "run_reference: $flutter_dir missing (run scripts/fetch-conformance.sh)" >&2; exit 2; }
[ -f "$flutter_dir/tool/conformance/run_conformance.dart" ] || { echo "run_reference: reference runner not found at the pin" >&2; exit 2; }

fixtures=""; out=""; filter=""
while [ $# -gt 0 ]; do
  case "$1" in
    --fixtures) fixtures="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --filter) filter="$2"; shift 2 ;;
    --help|-h)
      echo "usage: scripts/run_reference.sh --fixtures <dir> --out <dir> [--filter <glob>]"; exit 0 ;;
    *) echo "run_reference: unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$fixtures" ] && [ -n "$out" ] || { echo "run_reference: --fixtures and --out are required" >&2; exit 2; }
mkdir -p "$out"
case "$fixtures" in /*) ;; *) fixtures="$root/$fixtures" ;; esac
case "$out" in /*) ;; *) out="$root/$out" ;; esac
[ -d "$fixtures" ] || { echo "run_reference: fixtures directory not found: $fixtures" >&2; exit 2; }

# ── checkout prep ────────────────────────────────────────────────────────────
( cd "$flutter_dir" && flutter pub get )

quickjs_src="$(find "${HOME}/.pub-cache/hosted/pub.dev" -maxdepth 1 -type d \
  -name 'quickjs_runtime-*' 2>/dev/null | sort -V | tail -1)"
[ -n "$quickjs_src" ] || { echo "run_reference: no quickjs_runtime-* package under \$HOME/.pub-cache/hosted/pub.dev" >&2; exit 1; }
if [ ! -f "$quickjs_src/native/quickjs/libquickjs_bridge.so" ]; then
  bash "$quickjs_src/tool/build_quickjs.sh"
fi
mkdir -p "$flutter_dir/native/quickjs"
cp -f "$quickjs_src/native/quickjs/libquickjs_bridge.so" "$flutter_dir/native/quickjs/"

# ── run ──────────────────────────────────────────────────────────────────────
harness_args=()
if [ -f "$root/harness/harness.mjs" ]; then
  harness_args+=(--harness "$root/harness")
fi
cd "$flutter_dir"
if [ -n "$filter" ]; then
  dart run tool/conformance/run_conformance.dart \
    --fixtures "$fixtures" --out "$out" --filter "$filter" "${harness_args[@]+"${harness_args[@]}"}"
else
  dart run tool/conformance/run_conformance.dart \
    --fixtures "$fixtures" --out "$out" "${harness_args[@]+"${harness_args[@]}"}"
fi
