# jsr-harness — conformance harness

`harness/harness.mjs` is the JSR conformance harness (plan 1.5): comparator,
scorer, headless runner, coverage checker and mock server. Node >= 20, zero
runtime dependencies. The integration lane registers it as `bin` `jsr-harness`
(`node harness/harness.mjs` works everywhere).

```
jsr-harness compare --fixtures <dir> --results <dir> --out-report <file.md> [--out-badge <file.json>]
jsr-harness run --engine node|quickjs|chromium --fixtures <dir> --out <dir>
      [--filter <glob>] [--write-expect] [--bootstrap-dir <dir>] [--three <file>] [--settle <ms>]
jsr-harness coverage --fixtures <dir> --inventory <path>
jsr-harness mock <fixture-dir>
```

## Fixtures

`docs/conformance/fixtures/<id>/` with ids matching `^[a-z0-9_]+$`:

- `meta.json` — **authoritative**: `{ "categories": ["L0","L1"], "capabilities": [], "ignore": [], "nodes": ["column","text"], "mock": { "/path": { "status": 200, "body": {} } } }`. A missing or invalid `meta.json` is invalid input (exit 1). Capability names: `network`, `storage`, `secrets`, `assets`, `openUrl`, `capture`, `binary`, `scene3d`, `three`.
- `expected.json` — `{ "expect": { ... }, "actions": [ ... ] }`, never a dump. Allowed `expect` fields:
  - `renders` — exact number of `__jsr_render` messages,
  - `channels` — channel names that must occur, any order, compared case-insensitively with `_` removed (`setTitle` matches `set_title`),
  - `title` — the last `__jsr_set_title` payload,
  - `trace` — exact ordered list of trace verbs (channel names without the `__jsr_` prefix),
  - `state` — deep subset of the last `__jsr_export_state` payload,
  - `console` — substrings that must occur in `__jsr_log` payloads,
  - `finalDumpDelta` — map of delta path → expected value (see below).
- `widget.js` — the widget; `jsr.render(...)` payloads are the ground truth the expected AUI is derived from.

Actions (headless runners cannot execute them; rendering platform runners do): `{ "tap": "<nodeId|text>" }`, `{ "input": { "node": "<nodeId>", "value": "..." } }`, `{ "scroll": [dx, dy] }`, `{ "swipe": [x1, y1, x2, y2, ms] }`, `{ "wait": <ms> }`, `{ "back": true }`.

## AUI normalization (`harness/normalize.mjs`)

One implementation for the family (plan 1.3 rules, aliases copied from the
reference `UiViewTreeNormalizer`):

1. a `style` object merges into `props`; node keys win; `style` is removed;
2. props matching `/^on[A-Z]/` with a string value move to `events`;
3. `child` (object or string) and `children` (array) become `children`; bare strings become `text` nodes (`items` too — reference semantics);
4. the `key` prop is removed; `__iid` transport tags are removed;
5. type aliases resolve through the reference table (`harness/aliases.mjs`);
6. colors become `#RRGGBB` / `#RRGGBBAA` upper-case hex (`#abc`, `#abcd`, `rgb()`, `rgba()` accepted; named colors are out of contract); sizes stay numbers in logical pixels;
7. `nodeId` = `n<i>` by depth-first pre-order, root `n0`, every node counted.

Canonical node shape: `{ type, props, children, events, nodeId }` (props/children/events always present). `normalizeTree` accepts the protocol v0.1 `{ root: {...} }` wrapper and is idempotent.

## Comparison (`harness/compare.mjs`)

- children in order; props compared by key; numbers with tolerance **±1**; strings exact; colors exact (both sides are already normalized);
- `meta.json.ignore` lists prop names excluded from the dump compare at any depth;
- delta path grammar: `<type>[<selector>].<prop>[.<subprop>...]` where `<selector>` is the zero-based occurrence of that type in depth-first order or a `nodeId` (`text[1].data`, `text[n2].data`). The first prop segment resolves through the node's `props`; array indexes are written `key[0]`. The form `text.data#count` is **not** valid.

## `compare`

Loads every `*.result.json` of the results dir (sorted), loads the referenced
fixture for each (unknown fixture / bad file → exit 1 naming the path). The
expected AUI is derived from the result's own widget renders:
`normalizeTree(renders[0])` is the initial dump, `normalizeTree(renders[last])`
the final dump. The harness compares `dump` and `finalDump` against those,
applies `finalDumpDelta` to `finalDump` (falling back to the derived final
tree), then checks `renders`, `channels`, `title`, `trace`, `state`, `console`.
`status` in a result is written by the **runner** (`DONE` or `SKIP`); the
harness writes `PASS`/`FAIL` per fixture. Any `FAIL` → exit 2.

Report: `| Fixture | Level | Status | Diffs |` rows, then
`Score: <pct>% (passed <n>, failed <n>, skipped <n>)`. Badge:
`{ "platform", "score", "passed", "failed", "skipped", "generatedAt" }`
(score 0–100 or null). Weights: L0:1, L1:2, L2:3, L3:2, L4:5, 3D-API:2; a
fixture weighs the **maximum** of its categories; unknown categories weigh 1;
SKIP is excluded from both sums.

## `run` — the headless host

Runs fixtures without rendering (3D-API and L2 logic). Per fixture, boot order
(protocol §7): `var __IID = "<fixture id>";`, then `three.min.js` only when
`meta.json.capabilities` has `three`, then the runtime half, then the widget
half, then `widget.js`. Default sources: `src/bootstrap-runtime.js`,
`src/bootstrap-widget.js` and `libs/three/three.min.js` of the repository root;
`--bootstrap-dir` / `--three` override (tests use the stub pair in
`test/harness/stub/`). The fixture gets `var __JSR_MOCK_ORIGIN__` before its
own code.

The host side lives in `harness/host.mjs`, shared by all three engines:

- `__jsr_set_interval` / `__jsr_clear_interval` drive real timers; ticks call `__jsrInterval(id)`; `__jsr_raf` / `__jsr_caf` call `__jsrRaf(id, elapsed)` (one shot, ~16 ms);
- storage and secrets are in-memory; misses resolve `null` (secrets set resolves `true`);
- `__jsr_load_asset` reads the file from the fixture directory as text (path escapes → `null`, missing → `null`; it never rejects);
- `__jsr_fetch` resolves from the `meta.json.mock` map directly (same lookup rules as the mock server: origin ignored, query stripped; body for status < 400, `{ "__error": "HTTP <status>" }` otherwise; unknown path → `{ "__error": "no mock for <path>" }` which rejects the promise);
- `__jsr_export_state` lands in `state`;
- `__jsr_exec`, `__jsr_open_url`, `__jsr_host_call`, `__jsr_capture` resolve `{ "__error": "<channel> is not supported by this host" }`; the fire-and-forget lanes (`__jsr_host_call_binary`, `__jsr_scene3d_command`, `__jsr_event_done`) are dropped (protocol §5);
- raw-payload channels arrive `{ iid, id }`-wrapped and are unwrapped (protocol §1).

Engines:

- `node` — a `vm` context, real timers on the host event loop;
- `quickjs` — the binary at `$JSR_QJS_HARNESS` (`--iid`, `--preload`, `--script`, `--call`, `--out`; lines `channel<TAB>payload`). The binary has no host timers, so the runner replays deterministically: each round reruns the whole item list from scratch with one appended tick call per still-registered timer (earliest delay first, rAF first), until a round adds nothing or the 200-call cap is hit;
- `chromium` — Playwright: `window.sendMessage` bridges to the host through an exposed binding; timers fire back via `page.evaluate`. Needs the `playwright` devDependency and browser.

Fixtures with `actions` are `SKIP` (`skippedReason: "actions require a
rendering runner"`) — headless has no hit testing. `--settle <ms>` (default
1000) is the real-time window timers get. `--filter <glob>` selects fixture ids
(`*`/`?` wildcards). `--write-expect` copies the measured `state` into
`expect.state` of `expected.json` and refuses (exit 1) any fixture whose
`categories` do not contain `3D-API`.

Result files: `<out>/<fixture>.result.json` with the plan 1.4 fields —
`{ fixture, platform, status, dump, trace, diffs, screenshot, renders,
finalDump, title, state, console, error, skippedReason }`. `status` is `DONE`
or `SKIP`; platform is `node`, `quickjs` or `web`. Headless `dump`/`finalDump`
are the normalized render payloads (there is no view tree to walk). Run
exits 0 unless the input or engine is invalid (exit 1); data failures are
judged by `compare`.

## `coverage`

`--inventory` is the path of `inventory.json` or of the `docs/contract/nodes`
directory (then the file is `../inventory.json`). The file holds
`{ "nodes": [ { "type": "text", "events": ["onTap"], "props": ["data"] } ] }`
(`events`/`props` optional). Every node type and every event key must occur in
at least one `widget.js` of the fixtures directory. Prints totals — nodes,
props (when the inventory lists any), event keys, fixtures per level — and
exits 2 on a gap, 1 on invalid inventory/fixtures.

## `mock`

Serves the `meta.json.mock` map at `http://127.0.0.1:<port>`, prints exactly
one origin line, answers `OPTIONS` with
`Access-Control-Allow-Origin: *`, serves until SIGTERM. Used by platform
runners that fetch over real HTTP; the headless `run` host reads the same map
directly.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | pass |
| 1 | usage error or invalid input (message names the path) |
| 2 | failures (`compare`, `coverage`) |

## Engine availability in tests

`test/harness/engines.test.mjs` skips the quickjs/chromium tests when
`$JSR_QJS_HARNESS` / Playwright are absent and fails when
`JSR_REQUIRE_ENGINE=1` is set.
