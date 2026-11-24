# JSR Conformance Protocol v0.1

Platform-neutral test protocol proving that any jsr widget renderer is
behaviourally compatible with the reference implementation
([flutter_js_widget_runtime](https://github.com/IstiN/flutter_js_widget_runtime)).

A renderer "conforms" when it passes the canonical fixture set: same JS input
→ same abstract UI structure + same event trace, within documented tolerance.

**Implementations today:** Flutter (reference, golden-based) · Android
(POC runner, see android_js_widget_runtime).

---

## 1. Components

```
fixtures/<id>/          canonical input + platform-neutral expectation
  widget.js             self-contained JS widget (contract-only, no host API)
  expected.json         expected AUI dump + event trace + tolerance rules
  meta.json             categories, capabilities required (network, storage…)

runner (per platform)   loads fixture → drives interactions → emits result.json
harness (this repo)     compares result.json vs expected.json, scores, reports
```

## 2. Abstract UI dump (AUI) — the interchange format

Every renderer must expose `dumpViewTree()` producing this JSON. Structure,
not pixels: platform views map back to jsr nodes.

```json
{
  "root": {
    "type": "column",
    "props": { "spacing": 12, "mainAxisAlignment": "min" },
    "children": [
      { "type": "text", "props": { "data": "Hello from JS!",
        "fontSize": 24, "fontWeight": "bold", "color": "#f1f5f9" } },
      { "type": "textButton", "props": { "text": "Tap me" },
        "events": { "onTap": "tap" }, "nodeId": "n3" }
    ]
  }
}
```

Mapping rules:

| jsr concept | Flutter impl | Android impl |
|---|---|---|
| nodeId | widget `Key("jsr:<id>")` | `View.setTag(nodeId)` |
| type | renderer node case | renderer factory case |
| text | Text.data | TextView.getText() |
| fontSize (logical px) | style.fontSize | TextView.textSize / density |
| color | #RRGGBB(AA) | parseColor → #RRGGBB(AA) |
| bg color | Container.color | View background GradientDrawable |

Normalization: colors `#RRGGBB[AA]`, sizes logical px (dp), strings exact,
sizes tolerance ±1. `meta.json.ignore` lists props excluded from compare
(e.g. platform-specific elevation).

## 3. Event trace

Interactions are declared in `expected.json`, the runner executes them and
records what the widget did:

```json
{
  "actions": [ { "tap": "n3" }, { "wait": 1500 } ],
  "expect": {
    "renders": 2,
    "channels": [ "__jsr_render", "__jsr_set_title" ],
    "title": "Tapped: 1",
    "finalDumpDelta": { "text[n2].data": "Taps: 1" }
  }
}
```

Action verbs: `tap <nodeId|text>`, `input <nodeId> "value"`, `scroll <dx dy>`,
`swipe <x1 y1 x2 y2 ms>`, `wait <ms>`, `back`. Selectors by nodeId first,
by visible text fallback.

## 4. Categories & levels

| Level | Name | What it proves | Fixtures |
|---|---|---|---|
| L0 | structure | static tree per node type | 1 per node (~65) |
| L1 | interaction | taps, inputs, event payload | counters, forms |
| L2 | async | timers, rAF, fetch (mock), storage, secrets | clock, fetch-mock |
| L3 | effects | gradients/shadows/blur/transform **props** in AUI | 1 per effect |
| L4 | scenario | real widgets end-to-end | calculator, pomodoro, weather(mock) |
| 3D-API | three.js surface | scene-graph math identical to browser three.js | matrix/transform units |
| 3D-RENDER | three.js output | golden images (per-backend, out of contract scope) | 1A/1B per flutter#7,#8 |

L0–L4 are **contract** (must match everywhere). 3D-API fixtures are pure-JS
unit checks runnable in ANY engine (math does not touch the renderer).
3D-RENDER goldens are per-backend artifacts, tracked in flutter#7/#8, not
part of pass/fail conformance.

## 5. Fixture contract rules

- Widget code uses ONLY the jsr contract (bootstrap API). No `fetch` to real
  network unless `meta.json` declares `network: true` (then URL is a
  local mock server started by the runner).
- One fixture = one primary assertion. Compose scenarios in L4.
- Deterministic: no Date.now(), no Math.random() without seeded PRNG in
  fixture, all timers via jsr timers (harness-controlled virtual time for L2
  where supported).
- Every fixture lists `capabilities: []` so a runner can skip what it cannot
  serve and report `SKIP` (not FAIL).

## 6. Result & scoring

`result.json` (runner output):

```json
{
  "fixture": "counter",
  "platform": "android",
  "status": "PASS | FAIL | SKIP",
  "dump": { "...": "AUI" },
  "trace": [ "render", "setTitle" ],
  "diffs": [ { "path": "root.children[0].props.data", "expected": "0", "actual": "1" } ],
  "screenshot": "optional-png"
}
```

Score per platform = passed / (passed+failed) weighted L0:1, L1:2, L2:3,
L3:2, L4:5, 3D-API:2 (SKIP excluded). CI publishes per-platform badges;
a contract PR that adds a node without a fixture must fail the
`fixtures-coverage` check.

## 7. Seeded fixtures (this repo)

- `hello` — L0/L1: render tree, tap → setTitle + re-render (README example).
- `counter` — L1: full cycle tap→JS state→re-render, three buttons.
- `scroll_list` — L0: 30-item scroll list, scroll to bottom action.

Seed widgets are the proven POC trio (android_js_widget_runtime assets).

## 8. Runner checklist (per platform repo)

- [ ] `dumpViewTree()` per §2 (nodeId tags!)
- [ ] interaction driver per §3 verbs
- [ ] `result.json` emitter per §6
- [ ] CI job: run fixtures → harness compare → score badge
