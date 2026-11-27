# `switch`

Category: **input**

Builder: `_switchNode` — [source](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/nodes/js_input_nodes.dart#L12).



## Props

| Name | Type | Default | Effect | Source |
|---|---|---|---|---|
| `value` | boolean | false | — | [js_input_nodes.dart:12](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/nodes/js_input_nodes.dart#L12) |
| `color` | string | null | — | [js_input_nodes.dart:12](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/nodes/js_input_nodes.dart#L12) |
| `offsetX` | number | null | Transform translate X (logical px; applied together with offsetY), center-aligned | [json_widget_decoration.dart:46](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L46) |
| `offsetY` | number | null | Transform translate Y (logical px), center-aligned | [json_widget_decoration.dart:47](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L47) |
| `scale` | number | null | Transform uniform scale (1 = none) | [json_widget_decoration.dart:48](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L48) |
| `rotation` | number | null | Transform rotate around Z, radians (center-aligned) | [json_widget_decoration.dart:52](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L52) |
| `rotate` | number | null | Rotation in DEGREES (yoclip alias; converted to radians and used when `rotation` is absent) | [json_widget_decoration.dart:51](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L51) |
| `blur` | number|{sigma} | null | ImageFiltered gaussian blur, sigma in logical px (sigma <= 0 is skipped) | [json_widget_decoration.dart:7](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L7) |
| `opacity` | number | null | Opacity wrap, clamped to [0,1]; skipped when 1.0; ignored on `animatedOpacity` (it animates its own opacity) | [json_widget_decoration.dart:84](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L84) |
| `ignorePointer` | boolean | false | IgnorePointer wrap (overlay labels must not eat gestures) | [json_widget_decoration.dart:24](https://github.com/IstiN/flutter_js_widget_runtime/blob/fd9ca5895596f7b101649eb8d5fc92aad9d30af7/lib/src/renderer/json_widget_decoration.dart#L24) |

Universal effect props (applied to every node by `_applyUniversalEffects`) are
included above and marked by their effect column; the universal identity hint
`key` is documented in [jsr-api.md](../jsr-api.md).

## Events

- none

## Children

none

## Platform support

flutter=yes, android=yes, ios=partial, macos=partial, web=partial (source: [matrix.md](../matrix.md); wave D fills the final values).
