# JSR Conformance Protocol v0.2

Platform-neutral test protocol proving that any jsr widget renderer is
behaviourally compatible with the reference implementation
([flutter_js_widget_runtime](https://github.com/IstiN/flutter_js_widget_runtime)).

A renderer "conforms" when it passes the canonical fixture set: same JS input
→ same abstract UI structure + same event trace, within documented tolerance.

**Implementations today:** Flutter (reference, golden-based) · Android
(POC runner, see android_js_widget_runtime) · headless engines of this
repository's harness (`node`, `quickjs`, `chromium`).

## Amendments (chief decisions found by the fixture lanes)

- **A1 — new action `{ "submit": "<nodeId>" }`**: performs the keyboard done
  action on the named text node (`textField`, `textArea`, `searchBar`) and
  must dispatch `onSubmit` / `onSubmitted`
  ([IstiN/flutter_js_widget_runtime#17](https://github.com/IstiN/flutter_js_widget_runtime/issues/17)).
- **A2 — `scroll` vs `swipe`**: `{ "scroll": [dx, dy] }` is a **pointer
  scroll** (wheel or trackpad signal) at the center of the surface — it
  reaches `gestureDetector.onScroll` and scrollable containers.
  `{ "swipe": [x1, y1, x2, y2, ms] }` stays the **touch drag**
  ([IstiN/flutter_js_widget_runtime#18](https://github.com/IstiN/flutter_js_widget_runtime/issues/18)).
- **Comparator rule (as `harness/` implements it)**: props are compared by
  the keys of the **expected** tree — extra props carried by a dump are
  tolerated (e.g. a textButton's live-text `data` next to `text`), missing
  props are diffs. The reference field aliases
  (`UiViewTreeNormalizer`, e.g. flat `color` → `decoration.color` on
  `container`) are mirrored exactly in `harness/normalize.mjs`.
  `docs/harness.md` is the detailed comparator document.

---

## 1. Components

```
fixtures/<id>/          canonical input + platform-neutral expectation
  widget.js             self-contained JS widget (contract-only, no host API)
  expected.json         actions + expect block (never a dump)
  meta.json             authoritative: categories, capabilities, ignore, nodes, mock

runner (per platform)   loads fixture → drives interactions → emits result.json
harness (this repo)     derives the expected AUI from the widget renders,
                        compares result.json, scores, reports
```

## 2. Abstract UI dump (AUI) — the interchange format

Every renderer must expose `dumpViewTree()` producing this node shape:

```json
{
  "type": "column",
  "props": { "spacing": 12 },
  "children": [ { "type": "text", "props": { "data": "Hello!" } } ],
  "events": { "onTap": "tap" },
  "nodeId": "n0"
}
```

- **nodeId** = `n<i>` where `i` is the depth-first pre-order index of the
  node in the `jsr.render` payload (the root is `n0`; every node is counted,
  also layout-only nodes).
- **`key`** (string) is a universal optional prop: a reconciler identity
  hint. It is never rendered and never dumped.
- A platform node the renderer does not implement is rendered as the
  reference fallback shape (a card with the type name) with its node id tag;
  the dump stays structurally correct and the node is `partial` in that
  platform's `docs/node-support.json`.

### 2.1 Normalization (one implementation: `harness/normalize.mjs`)

Every runner produces dumps that are already normalized:

1. A `style` object is merged into `props`; node keys win over style keys;
   `style` is removed.
2. Props whose key matches `/^on[A-Z]/` and whose value is a string move to
   `events`. Event **keys** are normalized with the props: the reference
   folds `onChanged` → `onChange` on the input, value and dropdown families
   (`textField`/`input`/`textArea`, `switch`/`checkbox`/`slider`,
   `dropdown`/`select`), exactly like `UiViewTreeNormalizer`
   (`aliasDumpEventKeys`); `harness/normalize.mjs` mirrors it, so every
   normalized dump carries `onChange`, never `onChanged`, on those types.
3. `child` (one object) and `children` (array) become `children` (array) and
   leave `props`.
4. `key` is removed.
5. Type aliases are resolved with the alias table of the reference
   (`UiViewTreeNormalizer`); the table lives in `harness/aliases.mjs` and
   `docs/contract/jsr-api.md`.
6. Colors become `#RRGGBB` or `#RRGGBBAA` with upper-case hex. Sizes are
   numbers in logical pixels.
7. `nodeId` is assigned (rule above). Normalization is idempotent.

### 2.2 Dump source per platform (the dump proves what is on screen)

- **Flutter**: `dumpViewTree()` walks the `Element` tree, reads the stamped
  `Key('jsr:<nodeId>')`, and joins it with the applied-node record of the
  renderer; text-bearing props (`data`, text of inputs, tooltip) are read
  live from the built widgets.
- **Android / Apple**: the view tree is walked in order; every mapped root
  view carries its `nodeId` (`View.setTag(nodeId)`,
  `accessibilityIdentifier`); text-bearing props are read live from the
  view, other props come from the applied-node record.
- **React**: DOM reflection — every mapped element has
  `data-node-id="n<i>"` and `data-node-type="<type>"`; text-bearing props
  are read from the DOM node, other props from the applied-node record.

### 2.3 Comparison

- Children in order; props compared by the keys of the expected tree (extra
  actual props tolerated); numbers with tolerance ±1; strings and colors
  exact. `meta.json.ignore` lists prop names excluded for that fixture
  (top-level prop names of the normalized node).
- Delta path grammar: `<type>[<selector>].<prop>[.<subprop>...]`; the
  selector is a zero-based depth-first occurrence of that type or a `nodeId`
  (`text[1].data`, `text[n2].data`).

## 3. Fixtures, actions, expectations

### 3.1 meta.json (authoritative)

```json
{ "categories": ["L0", "L1"], "capabilities": [], "ignore": [],
  "nodes": ["column", "text"], "mock": { "/path": { "status": 200, "body": {} } } }
```

Capability names: `network`, `storage`, `secrets`, `assets`, `openUrl`,
`capture`, `binary`, `scene3d`, `three`. A runner that cannot serve a
capability reports `SKIP` (with `skippedReason`), never FAIL. The scorer
weight of a fixture is the maximum weight of its categories. Fixture ids
match `^[a-z0-9_]+$`.

### 3.2 expected.json

Holds `actions` (array) and `expect` — never a dump. The harness derives
the expected AUI from the widget's own renders
(`normalizeTree(renders[0])` initial, `normalizeTree(renders[last])` final).
Allowed `expect` fields:

| field | meaning |
|---|---|
| `renders` | number of `__jsr_render` messages |
| `channels` | channel names that must occur, in any order |
| `title` | last `__jsr_set_title` payload |
| `trace` | exact ordered verb list |
| `state` | deep subset of the last `__jsr_export_state` payload |
| `console` | substrings that must occur in `__jsr_log` payloads |
| `finalDumpDelta` | map of delta path → expected value |

### 3.3 Actions

```json
[ { "tap": "n3" }, { "input": { "node": "n1", "value": "hi" } },
  { "scroll": [0, 600] }, { "swipe": [50, 500, 50, 100, 300] },
  { "submit": "n1" }, { "wait": 250 }, { "back": true } ]
```

- `tap` selects by `nodeId` when the value matches `/^n\d+$/`, else by
  visible text.
- `scroll` is a pointer scroll at the surface center (A2); `swipe` is the
  touch drag. `wait` is real time on every platform.
- `submit` performs the keyboard done action on the named text node (A1).
- `back`: the runner calls the reference host-event global
  `__jsrHostEvent('back', {})` — the same call the reference conformance
  runner makes (`dispatchHostEvent('back', {})`).

### 3.4 Mock server and `__JSR_MOCK_ORIGIN__`

`jsr-harness mock <fixture-dir>` prints one line with the origin
`http://127.0.0.1:<port>` and serves `meta.json.mock` until SIGTERM; it
answers `OPTIONS` with `Access-Control-Allow-Origin: *`. Every runner
starts it and injects the origin into the engine as the global
`__JSR_MOCK_ORIGIN__` **before the widget** (`127.0.0.1` on host runners
and the iOS simulator, `10.0.2.2` on the Android emulator, the host address
on a physical Android device passed with the instrumentation argument
`mockOrigin`). The widget calls `jsr.fetchJson(__JSR_MOCK_ORIGIN__ + '/path')`.

## 4. Results and scoring

`result.json` per fixture and platform:

| field | meaning |
|---|---|
| `fixture`, `platform` | ids; platform ∈ `flutter`, `android`, `ios`, `macos`, `web` (headless engines use `node`, `quickjs`, `web`) |
| `status` | the runner writes `DONE` or `SKIP` only; the harness writes `PASS`/`FAIL` |
| `dump`, `finalDump` | normalized AUI per §2 (`null` for headless `SKIP`) |
| `renders` | raw `__jsr_render` payload strings in order |
| `trace` | verbs (channel name without `__jsr_`), send order |
| `title`, `state`, `console` | last payload / all log payloads |
| `diffs`, `screenshot` | runner may leave empty; harness fills `diffs` |
| `error`, `skippedReason` | string or `null` |

Score = Σ weights of passed fixtures / Σ weights of passed and failed
fixtures; weights L0:1, L1:2, L2:3, L3:2, L4:5, 3D-API:2; SKIP is excluded.
A contract change that adds a node or event key without a fixture must fail
the `fixtures-coverage` check.

### 4.1 Fixture levels and minimum counts

- **L0**: one fixture per registered node type, named `l0_<node>`.
- **L1**: one fixture per event key of the inventory, plus the seeds
  `hello`, `counter`.
- **L2**: `setTimeout`, `setInterval` with clear, `requestAnimationFrame`,
  `fetchJson` with mock, storage round-trip, secrets, `loadAsset`.
- **L3**: one fixture per effect prop: blur, clip, boxShadows, radial
  gradient, rotateX, rotateY, perspective, textShadow, textTransform,
  offsetX, offsetY, scale, rotation, opacity.
- **L4**: `calculator`, `pomodoro` (storage), `weather` (fetch mock) —
  deterministic ports of the Flutter example widgets.
- **3D-API**: scene graph build, Matrix4/Vector3 math, Euler/Quaternion
  math; the widget exports its results with `jsr.exportState(results)` and
  `expect.state` holds the exact values (reference values produced by
  `jsr-harness run --engine chromium --write-expect`).

## 5. The harness (`jsr-harness`, Node >= 20, zero runtime dependencies)

| command | behaviour |
|---|---|
| `jsr-harness compare --fixtures <dir> --results <dir> --out-report <file.md> [--out-badge <file.json>]` | loads every `*.result.json`, derives expected dumps, compares, scores, writes report + badge; exit 2 when a fixture fails or when the results directory holds no `*.result.json` (nothing verified — the report says `FAILED`, never a 0-passed/0-failed score) |
| `jsr-harness run --engine node\|quickjs\|chromium --fixtures <dir> --out <dir> [--filter <glob>] [--write-expect]` | runs fixtures headless (3D-API and L2 logic; fixtures with actions are SKIPped); `quickjs` needs `$JSR_QJS_HARNESS`; boot order `__IID` → three (capability `three`) → runtime half → widget half → widget.js |
| `jsr-harness coverage --fixtures <dir> --inventory <path>` | every node type and event key of the inventory occurs in at least one `widget.js`; exit 2 on a gap |
| `jsr-harness mock <fixture-dir>` | mock server per §3.4 |

Exit codes: 0 pass · 1 usage error or invalid input · 2 failures.
`scripts/count_coverage.sh` prints the contract totals and delegates the
coverage check. `docs/harness.md` documents the comparator in detail.

## 6. Seeded fixtures (this repo)

- `hello` — L0/L1: render tree, tap → setTitle + re-render (README example).
- `counter` — L1: full cycle tap→JS state→re-render, three buttons.
- `scroll_list` — L0: 30-item scroll list, scroll-to-bottom action.

Seed widgets are the proven POC trio (android_js_widget_runtime assets);
`scroll_list` currently carries the observed reference defects as its
behavior (flutter#11 children, pinned dump `color` — see its `meta.json`
notes) until the Flutter pin carries the fixes.

## 7. Runner checklist (per platform repo)

- [ ] `dumpViewTree()` per §2 (nodeId tags, normalized)
- [ ] interaction driver per §3.3 verbs, `back` via `__jsrHostEvent`
- [ ] `result.json` emitter per §4 (runner writes `DONE`/`SKIP`)
- [ ] CI job: run fixtures → harness compare → score badge
