# `flChart`

Category: **type as a thin wrapper so existing JSON trees still work.**

Builder: `_flChartNode` — [source](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L21).



## Props

| Name | Type | Default | Effect | Source |
|---|---|---|---|---|
| `chartType` | enum(line|bar|pie|radar|scatter) | null | — | [js_chart_nodes.dart:21](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L21) |
| `values` | color | null | — | [js_chart_nodes.dart:78](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L78) |
| `color` | string | null | — | [js_chart_nodes.dart:78](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L78) |
| `sections` | array | null | — | [js_chart_nodes.dart:113](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L113) |
| `centerSpaceRadius` | number | null | — | [js_chart_nodes.dart:113](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L113) |
| `features` | array | null | — | [js_chart_nodes.dart:143](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L143) |
| `entries` | array | null | — | [js_chart_nodes.dart:143](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L143) |
| `points` | array | null | — | [js_chart_nodes.dart:202](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L202) |
| `minX` | number | null | — | [js_chart_nodes.dart:202](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L202) |
| `maxX` | number | null | — | [js_chart_nodes.dart:202](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L202) |
| `minY` | number | null | — | [js_chart_nodes.dart:202](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L202) |
| `maxY` | number | null | — | [js_chart_nodes.dart:202](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L202) |
| `series` | array | null | — | [js_chart_nodes.dart:39](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L39) |
| `curved` | boolean | true | — | [js_chart_nodes.dart:39](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L39) |
| `showGrid` | boolean | true | — | [js_chart_nodes.dart:39](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/nodes/js_chart_nodes.dart#L39) |
| `offsetX` | number | null | Transform translate X (logical px; applied together with offsetY), center-aligned | [json_widget_decoration.dart:46](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L46) |
| `offsetY` | number | null | Transform translate Y (logical px), center-aligned | [json_widget_decoration.dart:47](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L47) |
| `scale` | number | null | Transform uniform scale (1 = none) | [json_widget_decoration.dart:48](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L48) |
| `rotation` | number | null | Transform rotate around Z, radians (center-aligned) | [json_widget_decoration.dart:52](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L52) |
| `rotate` | number | null | Rotation in DEGREES (yoclip alias; converted to radians and used when `rotation` is absent) | [json_widget_decoration.dart:51](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L51) |
| `blur` | number|{sigma} | null | ImageFiltered gaussian blur, sigma in logical px (sigma <= 0 is skipped) | [json_widget_decoration.dart:7](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L7) |
| `opacity` | number | null | Opacity wrap, clamped to [0,1]; skipped when 1.0; ignored on `animatedOpacity` (it animates its own opacity) | [json_widget_decoration.dart:84](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L84) |
| `ignorePointer` | boolean | false | IgnorePointer wrap (overlay labels must not eat gestures) | [json_widget_decoration.dart:24](https://github.com/IstiN/flutter_js_widget_runtime/blob/1fa2ec41ab8428a25085711ca743e5ecc4909c1d/lib/src/renderer/json_widget_decoration.dart#L24) |

Universal effect props (applied to every node by `_applyUniversalEffects`) are
included above and marked by their effect column; the universal identity hint
`key` is documented in [jsr-api.md](../jsr-api.md).

## Events

- none

## Children

none

## Platform support

flutter=yes, android=partial, ios=partial, macos=partial, web=partial (source: [matrix.md](../matrix.md))
