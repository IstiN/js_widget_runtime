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
