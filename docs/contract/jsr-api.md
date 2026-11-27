# jsr.* API contract

The complete `jsr` surface a widget may call, with signatures and source
links into the pinned reference
(`IstiN/flutter_js_widget_runtime` @ `1fa2ec41ab8428a25085711ca743e5ecc4909c1d`,
`lib/src/runtime/js_widget_bootstrap.dart` — the file line links below).

The bootstrap is split into two canonical halves
(`src/bootstrap-runtime.js`, `src/bootstrap-widget.js`); the members are
listed here in reference order: **runtime members** (13), **widget members**
(19), then the host-to-JS globals, the universal `key` prop, the type alias
table of `UiViewTreeNormalizer`, and the widget manifest fields.

Payload convention: outgoing messages are `sendMessage(channel, json)`; every
payload is tagged with the instance id (`__IID`) by `__tag`. An async host
answer resolves the call's promise through `__jsrResolve(id, value)`; an error
answer is `{__error: '<message>'}` and rejects the promise.

## Runtime members (13)

| Member | Signature | Channel(s) | Notes | Source |
|---|---|---|---|---|
| `jsr.fetchJson` | `fetchJson(url, opts?) → Promise<object>` | `__jsr_fetch` | `{id, url, method (GET), headers {}}`; rejects on `{__error}` | [#L206](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L206) |
| `jsr.exec` | `exec(cmd) → Promise` | `__jsr_exec` | `{id, cmd}`; host-gated | [#L214](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L214) |
| `jsr.openUrl` | `openUrl(url) → Promise` | `__jsr_open_url` | `{id, url}` | [#L225](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L225) |
| `jsr.hostCall` | `hostCall(name, args?) → Promise` | `__jsr_host_call` | generic host capability `{id, name, args {}}` | [#L237](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L237) |
| `jsr.hostCallBinary` | `hostCallBinary(name, data) → void` | `__jsr_host_call_binary` | name sanitized `[^A-Za-z0-9._-]→_`; typed arrays cross the native bytes lane when the host registered `__jsrSendBytes`, else base64 string lane | [#L325](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L325) |
| `jsr.b64encode` | `b64encode(data) → string` | — (local) | typed arrays encode their byte image; ArrayBuffers/array-likes element-wise | [#L249](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L249) |
| `jsr.capture` | `capture(opts?) → Promise` | `__jsr_capture` | `{id, opts {}}` | [#L354](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L354) |
| `jsr.storage` | `.get(key) → Promise` / `.set(key, val) → Promise` | `__jsr_storage_get` / `__jsr_storage_set` | get: `{id, key}`; set: `{key, value}`; a session cache short-circuits repeat gets | [#L362](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L362) |
| `jsr.exportState` | `exportState(obj?) → void` | `__jsr_export_state` | `{}` default | [#L381](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L381) |
| `jsr.secrets` | `.get(key) → Promise` / `.set(key, val) → Promise` / `.delete(key) → Promise` | `__jsr_secrets_get` / `__jsr_secrets_set` | delete = set with `value: null` | [#L426](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L426) |
| `jsr.loadAsset` | `loadAsset(path) → Promise` | `__jsr_load_asset` | `{id, path}` | [#L460](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L460) |
| `jsr.scene3d` | `create(sceneId, config)` / `destroy(sceneId)` / `addModel(sceneId, options)` / `removeModel(sceneId, modelId)` / `setTransform(sceneId, modelId, transform)` / `setTransforms(sceneId, items)` / `playAnimation(sceneId, modelId, options)` / `stopAnimation(sceneId, modelId)` / `onTap(sceneId, fn)` / `setCamera(sceneId, camera)` / `setLight(sceneId, light)` | `__jsr_scene3d_command` | every call wraps `{kind, sceneId, payload {}}`; `onTap` registers a local handler fed by `__jsrHostEvent('scene3d.tap:<id>', …)` | [#L469](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L469) |
| `jsr.audio` | `.synth(opts) → __JsAudioSynth` / `.noteToFrequency(note) → number` | `__jsr_host_call_binary` (track upload) | pure-JS synth (oscillators, filters, envelope, delay/reverb); track PCM crosses as bytes | [#L197](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L197) |

## Widget members (19)

| Member | Signature | Notes | Source |
|---|---|---|---|
| `jsr.ease` | `{linear, easeIn, easeOut, easeInOut, easeInOutCubic, easeInOutQuart, easeOutExpo, bounce, elastic, backIn, backOut, cubicBezier(x1,y1,x2,y2)}` + aliases `easeOutBack=backOut`, `easeOutBounce=bounce`, `easeOutElastic=elastic` | each entry is `function(t) → t'` in `[0,1]`; `cubicBezier` solves a CSS-style curve | [#L125](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L125) |
| `jsr.motion` | `.tween(ms, startMs, durationMs, from, to, easing?) → number` / `.mapRange(v, inMin, inMax, outMin, outMax, easing?) → number` / `.clamp(v, min, max)` / `.wave(ms, periodMs, amplitude, phase?) → number` | declarative tweening helpers; clamped t | [#L163](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L163) |
| `jsr._easeFn` | `_easeFn(e) → function` | function → itself, string name → `jsr.ease[name]`, else linear | [#L187](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L187) |
| `jsr.render` | `render(tree)` | sends `__jsr_render` with the tree; stamps `tree.__iid` | [#L202](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L202) |
| `jsr.setTitle` | `setTitle(t)` | `__jsr_set_title` with `String(t)` | [#L204](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L204) |
| `jsr._handler` | `function(actionId, payload)` \| `null` | current event handler slot (set by `onEvent`) | [#L385](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L385) |
| `jsr.onEvent` | `onEvent(fn)` | installs `fn` as `jsr._handler` | [#L386](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L386) |
| `jsr._keyHandler` | `function(payload)` \| `null` | current key handler slot | [#L391](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L391) |
| `jsr.onKey` | `onKey(fn)` | installs `fn` as `jsr._keyHandler` | [#L393](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L393) |
| `jsr.theme` | `{isDark, bg, surface, surfaceAlt, border, borderBright, accent, accent2, onAccent, text, muted}` | dark palette defaults | [#L396](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L396) |
| `jsr._onThemeChange` | `function(theme)` \| `null` | theme callback slot | [#L397](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L397) |
| `jsr.onThemeChange` | `onThemeChange(fn)` | installs `fn` as `jsr._onThemeChange` | [#L398](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L398) |
| `jsr._viewport` | object \| `null` | last `{width, height}` reported by the host | [#L403](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L403) |
| `jsr._viewportHandler` | `function(viewport)` \| `null` | viewport callback slot | [#L404](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L404) |
| `jsr.viewport` | `viewport() → {width, height} \| null` | reads `jsr._viewport` | [#L405](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L405) |
| `jsr.onViewport` | `onViewport(fn)` | installs `fn` as `jsr._viewportHandler` | [#L406](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L406) |
| `jsr.breakpoint` | `breakpoint(w?) → 'compact'\|'medium'\|'expanded'` | `<600` compact, `<840` medium, else expanded; default width = current viewport | [#L409](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L409) |
| `jsr.adaptive` | `adaptive(map) → value` | picks `map[breakpoint]` with medium→compact, expanded→medium→compact fallbacks | [#L416](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L416) |
| `jsr.showError` | `showError(msg)` | renders a centered warning card with the message | [#L450](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L450) |

## Host-to-JS globals

Installed by the two canonical halves (runtime first, then widget).

| Global | Signature | Direction | Source |
|---|---|---|---|
| `console` | `log/warn/error/info/debug(...)` → `__jsr_log` | JS → host | [#L90](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L90) |
| `setTimeout(fn, ms)` / `clearTimeout(id)` | `__jsr_set_interval {once:true}` / `__jsr_clear_interval` | JS → host, host ticks back | [#L106](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L106) |
| `setInterval(fn, ms)` / `clearInterval(id)` | `__jsr_set_interval {ms:1000 default}` / `__jsr_clear_interval` | JS → host | [#L108](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L108) |
| `requestAnimationFrame(fn)` / `cancelAnimationFrame(id)` | `__jsr_raf {id, iid}` / `__jsr_caf` | JS → host, host ticks `__jsrRaf(id, elapsed)` | [#L111](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L111) |
| `__jsrResolve(id, value)` | resolves the pending call promise registered under `id` | host → JS | [#L18](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L18) |
| `__jsrInterval(id)` | fires the interval/timeout callback registered under `id` | host → JS | [#L24](https://github://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L24) |
| `__jsrRaf(id, elapsed)` | fires the rAF callback with the elapsed ms | host → JS | [#L28](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L28) |
| `__jsrWarmResolve(id, value, size)` | resolves a warm-value request (host-side cache announcement) | host → JS | [#L68](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L68) |
| `__jsrHostEvent(target, payload)` | dispatches a host event: `key`, `viewport`, `three.blur`, `three.input:*`, `scene3d.tap:*`, `gesture:*` | host → JS (widget half) | [#L1102](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/runtime/js_widget_bootstrap.dart#L1102) |

Id semantics: `__nid()` returns `'i' + (++__idCounter)`; outgoing payloads are
tagged with `__IID`; incoming host events are never filtered by `__IID`.

## The universal `key` prop

`key: string` — optional reconciler identity hint on ANY node
(contract prop of android_js_widget_runtime#2). The flutter reference does not
consume it (node ids are positional, `_nodeIds` counter,
[#L292](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_renderer.dart#L292));
it is never rendered and never dumped.

## Type alias table (`UiViewTreeNormalizer._typeAliases`)

Node `type` values are resolved through this table before rendering
([source](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/ui_view_tree_normalizer.dart#L159)).
Unknown types pass through unchanged. The same table is committed in
`inventory.json.aliases` (generated).

| Alias | Canonical | | Alias | Canonical |
|---|---|---|---|---|
| `Text`/`text`/`Label`/`label`/`p`/`span` | `text` | | `TextInput`/`textInput`/`input` | `textField` |
| `Button`/`button`/`ElevatedButton`/`elevatedButton` | `button` | | `TextArea`/`textarea` | `textArea` |
| `TextButton` | `textButton` | | `Switch` | `switch` |
| `OutlinedButton` | `outlinedButton` | | `Checkbox` | `checkbox` |
| `IconButton` | `iconButton` | | `Slider` | `slider` |
| `Rect` | `rect` | | `Markdown`/`md` | `markdown` |
| `Circle` | `circle` | | `Avatar`/`CircleAvatar`/`avatar` | `circleAvatar` |
| `Line` | `line` | | `Chip`/`Tag`/`tag` | `chip` |
| `Polygon` | `polygon` | | `Badge` | `badge` |
| `View`/`view`/`div`/`Fragment` | `column` | | `Dropdown`/`Select`/`select` | `dropdown` |
| `box`/`Box` | `container` | | `InkWell` | `inkWell` |
| `ScrollView`/`scrollView`/`scroll`/`SingleChildScrollView`/`singleChildScrollView` | `scroll` | | `GestureDetector` | `gestureDetector` |
| `ListView` | `listView` | | `SafeArea` | `safeArea` |
| `GridView` | `gridView` | | `Divider` | `divider` |
| `Image`/`networkImage`/`NetworkImage`/`img` | `image` | | `Spacer` | `spacer` |
| `Svg`/`SVG` | `svg` | | `Icon` | `icon` |
| `Card` | `card` | | `Scene3d`/`scene3d`/`scene3D`/`3d`/`model3d`/`model`/`glb` | `scene3d` |
| `Row` | `row` | | `Column` | `column` |
| `Stack` | `stack` | | `Center` | `center` |
| `Padding` | `padding` | | `SizedBox` | `sizedBox` |
| `Container` | `container` | | `ListTile`/`listItem`/`ListItem` | `listTile` |
| `ProgressBar`/`progress`/`linearProgress` | `linearProgressIndicator` | | `ActivityIndicator`/`spinner` | `circularProgressIndicator` |

Field aliases applied by the normalizer ([source](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/ui_view_tree_normalizer.dart#L64)):
`content`/`label` → `data` (text), `title`/`text` → `data` (buttons),
`backgroundColor`/`color` → `decoration.color` (boxes), `placeholder` → `hint`
and `value` → `initialValue` (inputs), `uri`/`source` → `url` (image),
`markup` → `data` (svg), `onChanged` → `onChange` (value types),
`items` → `children`, string children → `{type:'text', data}`, flex
`child` → one-element `children`.

## Widget manifest fields

Read by `WidgetManifest.fromStorage` from `manifest.json` next to
`widget.js` ([source](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/model/widget_manifest.dart#L238));
tolerant parsing: one wrong-typed field degrades that field only.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | directory name | unique identifier |
| `name` | string | directory name | display name |
| `description` | string | `''` | display description |
| `version` | string | `'1.0.0'` | widget version |
| `icon` | string | `'🔧'` | emoji/short label |
| `allowedCommands` | string[] | `[]` | commands the widget may call via the CLI host capability (`["*"]` = all, dev only) |
| `network` | boolean | `true` | informational network flag (enforced by CSP) |
| `files` | string[] | `widget.js` | ordered JS files to concatenate as the entry point |
| `cli` | object | `null` | optional CLI help metadata for agents |

Without a manifest the loader derives the defaults from the directory name.
