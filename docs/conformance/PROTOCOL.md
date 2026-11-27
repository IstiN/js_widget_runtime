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
- **A3 — scroll state in the dump**: the dump of a scrollable container
  (resolved type `scroll`) carries `scrollOffset`, `scrollExtent`,
  `viewportExtent` (§2); the delta grammar resolves the derived
  `scrolledToEnd` on such nodes. A scrollable dump without the scroll state
  fails the fixture — missing is not zero, and the `meta.json.ignore` list
  never applies to it. This restores the v0.1 scroll outcome assertion
  (`scrollsToEnd`/`lastVisibleText`) that v0.2 had dropped: a renderer whose
  scroll container ignores `swipe` now FAILS `scroll_list`.
- **A4 — the 3D family-wide split is restored**: **3D-API** (three.js
  scene-graph math) stays **in contract**; **3D-RENDER** (golden images,
  per-backend) is **out of pass/fail scope** and tracked by
  [flutter#7](https://github.com/IstiN/flutter_js_widget_runtime/issues/7) /
  [flutter#8](https://github.com/IstiN/flutter_js_widget_runtime/issues/8)
  (§4.1). v0.2 had silently dropped the 3D-RENDER definition; it is back as
  an explicit out-of-contract statement.
- **A5 — `scroll_list` no longer depends on platform momentum** (chief
  decision, owner may veto): the seed performs **16** `swipe`s of the same
  gesture `[49, 180, 49, 40, 150]` instead of three. Decision record with
  the measured numbers from the three A3 platform heads: three swipes
  reached the end only through the fling physics of each reference test
  environment —
  flutter `135ac6b9` (run
  [45922768568](https://github.com/IstiN/flutter_js_widget_runtime/actions/runs/45922768568),
  green 9/9 jobs, 137/137 fixtures, `scroll_list` PASS): content extent
  2610, viewport 600; the runner's swipe had to become a real touch drag
  (8 quadratic-eased samples, lift with tracked velocity, bounded settle)
  because the old single-move drag carried zero estimated velocity and
  settled at 975.11 px; three swipes settle at exactly `2010.0` =
  `maxScrollExtent`.
  apple `242098b` (probe run
  [45923825392](https://github.com/vabhzw17eg2qu4m9-bit/flutter_js_widget_runtime/actions/runs/45923825392),
  green, `scroll_list` PASS on macOS and iOS): the driver applies a swipe
  as drag delta plus a coast computed from the iOS normal deceleration
  model (0.998 per ms) — 140 px in 150 ms carries 605.7 px; macOS numbers:
  extent 1590, viewport 700, range 890.
  android `a9d93d6` (run
  [45921724145](https://github.com/IstiN/android_js_widget_runtime/actions/runs/45921724145)):
  real touch events through the native fling; the three swipes move
  870 px (≈ 290 px per swipe: 140 drag + ≈ 150 native fling); dumped
  `scrollOffset` 870 / `scrollExtent` 4470 / `viewportExtent` 616 →
  `scrolledToEnd` false, `scroll_list` FAIL (1 diff); with the reference
  content height the need would be 1994 px (scroll range 3854 px) against
  870 px of native carry — no device profile and no layout parity closes
  it. Conclusion: three 140 px / 150 ms swipes reach the end only through
  the fling physics of the reference test environment; as a cross-platform
  proof of native scroll the seed depended on momentum Android does not
  have natively. The fix: 16 × 140 = 2240 px of pure drag covers the
  reference scroll range (2010 px at the flutter pin) with margin — a
  renderer whose scroll container ignores `swipe` still FAILS (the offset
  stays 0), flutter and apple pass on drag alone, android passes with its
  native fling carry (≈ 150 px per swipe → ≈ 4640 px total ≥ its 3854 px
  need). The assertion is unchanged:
  `"finalDumpDelta": { "scroll[n0].scrolledToEnd": true }`.
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
- **Scroll state (A3)**: the dump of a scrollable container (resolved type
  `scroll`) carries three numbers in `props`, primary axis, logical pixels,
  read live from the scrollable at dump time:

  | prop | meaning | reference reading (Flutter) |
  |---|---|---|
  | `scrollOffset` | current position, `0` = start | `ScrollPosition.pixels` |
  | `scrollExtent` | full scrollable content extent | `maxScrollExtent + viewportDimension` |
  | `viewportExtent` | visible viewport extent | `ScrollPosition.viewportDimension` |

  The comparator enforces their presence on every scrollable node of the
  dump (initial **and** final): a dump that lacks them fails the fixture —
  missing is not zero. A renderer whose scroll container ignores a `swipe`
  keeps `scrollOffset: 0` and fails through the derived assertion below.
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
   numbers in logical pixels. The A3 scroll-state props
   (`scrollOffset`, `scrollExtent`, `viewportExtent`) pass through
   normalization unchanged and idempotently; `harness/normalize.mjs`
   exports `isScrollableType` as the one scrollable-type predicate.
7. `nodeId` is assigned (rule above). Normalization is idempotent.

### 2.2 Dump source per platform (the dump proves what is on screen)

- **Flutter**: `dumpViewTree()` walks the `Element` tree, reads the stamped
  `Key('jsr:<nodeId>')`, and joins it with the applied-node record of the
  renderer; text-bearing props (`data`, text of inputs, tooltip) are read
  live from the built widgets, the A3 scroll state is read live from the
  scrollable's position.
- **Android / Apple**: the view tree is walked in order; every mapped root
  view carries its `nodeId` (`View.setTag(nodeId)`,
  `accessibilityIdentifier`); text-bearing props are read live from the
  view, other props come from the applied-node record; the A3 scroll state
  is read live from the scrollable (offset / content range / viewport size).
- **React**: DOM reflection — every mapped element has
  `data-node-id="n<i>"` and `data-node-type="<type>"`; text-bearing props
  are read from the DOM node, other props from the applied-node record; the
  A3 scroll state is read live from the scrolling element
  (`scrollTop` / `scrollHeight` / `clientHeight`).

### 2.3 Comparison

- Children in order; props compared by the keys of the expected tree (extra
  actual props tolerated); **numbers: the ±1 logical-pixel tolerance applies
  to px-size props only** (the leaf prop key decides — `width`, `height`,
  `fontSize`, `padding`, `margin`, `spacing`, radii, borders, blur, offsets,
  edge insets; the full list is `PX_SIZE_PROPS` in `harness/compare.mjs`).
  **Every other number compares exact**: dump numbers are applied payload
  values (`opacity: 0.5`, `scale`, `flex`, `progress`, durations, counts),
  not measurements, so exact is the strongest portable assertion — an
  `l3_opacity` expecting 0.5 fails against 0, 1 or 1.5. Strings and colors
  are exact. `meta.json.ignore` lists prop names excluded for that fixture
  (top-level prop names of the normalized node); it never applies to the
  A3 scroll-state presence check.
- Delta path grammar: `<type>[<selector>].<prop>[.<subprop>...]`; the
  selector is a zero-based depth-first occurrence of that type or a `nodeId`
  (`text[1].data`, `text[n2].data`). The leaf prop segment of the path
  decides size-ness for the tolerance. On a scrollable node the grammar also
  resolves the derived prop **`scrolledToEnd`** =
  `scrollOffset >= scrollExtent - viewportExtent` (the universal at-end
  predicate; `true` also when the content fits the viewport) — platforms
  never dump the boolean itself, and an unknown value (state missing) is a
  diff, not `false`.

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
| `finalDumpDelta` | map of delta path → expected value; this is where scroll outcome assertions live (e.g. `"scroll[n0].scrolledToEnd": true`, §2 A3) |

### 3.3 Actions

```json
[ { "tap": "n3" }, { "input": { "node": "n1", "value": "hi" } },
  { "scroll": [0, 600] }, { "swipe": [50, 500, 50, 100, 300] },
  { "submit": "n1" }, { "wait": 250 }, { "back": true } ]
```

- `tap` selects by `nodeId` when the value matches `/^n\d+$/`, else by
  visible text.
- `scroll` is a pointer scroll at the surface center (A2); `swipe` is the
  touch drag. `wait` is real time on every platform. A `swipe` (or
  `scroll`) over a scrollable container must actually scroll it: the dump
  then reflects the moved `scrollOffset` (A3), which is how `scroll_list`
  proves native scroll.
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
- **3D-API** (in contract): scene graph build, Matrix4/Vector3 math,
  Euler/Quaternion math; the widget exports its results with
  `jsr.exportState(results)` and `expect.state` holds the exact values
  (reference values produced by `jsr-harness run --engine chromium
  --write-expect`). 3D-API fixtures are pure-JS unit checks runnable in any
  engine — the math does not touch the renderer.
- **3D-RENDER** (out of contract, restored by amendment A4): golden images
  of three.js output, per-backend artifacts. They are **not** part of
  pass/fail conformance and have no fixtures here; the 1A/1B golden-image
  work is tracked by
  [flutter#7](https://github.com/IstiN/flutter_js_widget_runtime/issues/7)
  and [flutter#8](https://github.com/IstiN/flutter_js_widget_runtime/issues/8).
  L0–L4 and 3D-API are contract (must match everywhere); 3D-RENDER is not.

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
- `scroll_list` — L0: 30-item scroll list; **16** identical `swipe`s of the
  gesture `[49, 180, 49, 40, 150]` (A5 — the count must not depend on
  platform momentum) must scroll the container to its end — asserted
  through A3 as `"finalDumpDelta": { "scroll[n0].scrolledToEnd": true }`.

Seed widgets are the proven POC trio (android_js_widget_runtime assets);
the pinned flutter reference behavior they carry is documented in each
seed's `meta.json` notes (scroll_list: flat dump `color`; the former
flutter#11 children defect does not reproduce at the pin).

## 7. Runner checklist (per platform repo)

- [ ] `dumpViewTree()` per §2 (nodeId tags, normalized; A3 scroll state on
      every scrollable container)
- [ ] interaction driver per §3.3 verbs, `back` via `__jsrHostEvent`;
      `swipe`/`scroll` actually move scrollables
- [ ] `result.json` emitter per §4 (runner writes `DONE`/`SKIP`)
- [ ] CI job: run fixtures → harness compare → score badge
