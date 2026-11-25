# js_widget_runtime

The platform-neutral **UI contract** for jsr widgets: JSON node schema,
semantics, and the conformance protocol every renderer must pass.

- Runtime core (engines, messaging, bootstrap IO): [js_runtime](https://github.com/IstiN/js_runtime)
- Reference renderer: [flutter_js_widget_runtime](https://github.com/IstiN/flutter_js_widget_runtime)
- Android renderer: [android_js_widget_runtime](https://github.com/IstiN/android_js_widget_runtime)

## Contents

- `docs/conformance/PROTOCOL.md` — **the testing protocol** (AUI dump format,
  event trace, fixture rules, scoring).
- `docs/conformance/fixtures/` — canonical fixtures (seeded with the
  proven POC trio: hello / counter / scroll_list).
- `docs/contract/` — the node inventory, `jsr.*` API reference, effect
  semantics and the per-platform support matrix.
- `harness/` — `jsr-harness`: fixture runner (node / quickjs / chromium
  headless), comparator, scorer, mock server.

## Quality gate

Two local commands (CI runs them in the `Quality` workflow; the CRAP gate
threshold is 8.0 over first-party code — the generated bootstrap copies
`src/bootstrap-runtime.js` and `src/bootstrap-widget.js` are excluded as
generated files):

```bash
# unit tests with coverage (writes coverage/coverage-final.json)
npx c8 --reporter=json --reporter=text --include='src/**' --include='harness/**' \
  node --test "test/*.test.js" "test/harness/*.test.mjs"

# CRAP gate over harness/** (src/ is generated copies, excluded)
npx crap4js src harness --coverage coverage/coverage-final.json --threshold 8.0 \
  --exclude 'src/bootstrap-runtime.js' --exclude 'src/bootstrap-widget.js'
```

The CRAP tool is [`crap4js`](https://github.com/vabhzw17eg2qu4m9-bit/crap4js)
installed as the pinned devDependency `github:vabhzw17eg2qu4m9-bit/crap4js#v0.34.0`
(never the unrelated npm-registry package of the same name). A function
above 8.0 CRAP is split or better tested — the threshold never moves.
