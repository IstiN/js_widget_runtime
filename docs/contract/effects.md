# Effect props contract

One row per effect prop: where it applies, what it does, how a host learns
about an update, and the payload shape. Static render props are carried by
`__jsr_render` payloads (a new value arrives with the next render; there is no
dedicated effect channel). The two `three.*` host events are the only
effect-adjacent events on the host-event lane.

Sources are the pinned reference `1fa2ec41ab8428a25085711ca743e5ecc4909c1d`.

| Node type(s) | Prop | Effect kind | Event name | Payload |
|---|---|---|---|---|
| every node | `offsetX` | `Transform.translate` X, logical px, center-aligned (`_applyTransformEffects`) | `__jsr_render` (next render carries the new value) | `number \| null` |
| every node | `offsetY` | `Transform.translate` Y, logical px, center-aligned | `__jsr_render` | `number \| null` |
| every node | `scale` | uniform `Transform.scale` (1 = none) | `__jsr_render` | `number \| null` |
| every node | `rotation` | rotate around Z, radians, center-aligned | `__jsr_render` | `number \| null` |
| every node | `rotate` | degrees alias of `rotation` (used only when `rotation` is absent) | `__jsr_render` | `number \| null` |
| every node | `opacity` | `Opacity` wrap, clamped to [0,1]; skipped when 1.0; ignored on `animatedOpacity` | `__jsr_render` | `number \| null` |
| every node | `blur` | `ImageFiltered` gaussian blur, sigma in logical px; `sigma <= 0` skipped | `__jsr_render` | `number \| {sigma}` |
| every node | `ignorePointer` | `IgnorePointer` wrap (overlay labels keep gestures below alive) | `__jsr_render` | `boolean` (default `false`) |
| `container` | `clip` | `ClipRRect` over the child with the decoration/`borderRadius` radius | `__jsr_render` | `boolean` (default `false`) |
| `container` | `decoration.gradient` | linear gradient (`begin`/`end` alignments, `centerLeft` default begin); fewer than 2 colors falls back to the flat color | `__jsr_render` | `{colors: string[], stops?: number[], begin?: alignment, end?: alignment}` |
| `container` | `decoration.gradient` (`type: 'radial'`) | radial gradient, center default `center` (Alignment.center), radius default 0.5 | `__jsr_render` | `{type: 'radial', colors: string[], stops?: number[], center?: alignment, radius?: number}` |
| `container`, `card` | `decoration.shadows` / `shadow` | `BoxShadow` list | `__jsr_render` | `[{color?: color, blur?: number (4), spread?: number (0), offsetX?: number (0), offsetY?: number (0)}]` |
| `container`, `card`, `animatedContainer` | `decoration.color`, `borderRadius`, `borderColor`, `borderWidth` | box paint: fill color, rounded corners (`jsBorderRadius`: number or 4-corner list), border | `__jsr_render` | `color`, `number \| number[4]`, `color`, `number` (1) |
| `container`, `card`, `animatedContainer`, and every node via `transform` | `transform` | `Matrix4` build: translate, scale, perspective (`setEntry(3,2,-1/perspective)` when > 0), `rotateX`, `rotateY`, rotate Z — in this order | `__jsr_render` | `{translateX?: number (0), translateY?: number (0), scale?: number (1), rotate?: number (0, radians), rotateX?: number (0, radians), rotateY?: number (0, radians), perspective?: number (0)}` |
| `text` | `style.textShadows` / `style.shadows` | text `Shadow` list | `__jsr_render` | `[{color?: color, blur?: number, offsetX?: number, offsetY?: number}]` |
| `text` | `style.textTransform` | case transform of the rendered data (`uppercase`/`lowercase`) | `__jsr_render` | `string` (`uppercase` \| `lowercase`, anything else = none) |
| `text` | `style.gradient` | `ShaderMask` gradient tint (blend `srcIn`) over the glyphs | `__jsr_render` | `{colors: string[], stops?: number[], begin?, end?}` |
| `animatedContainer`, `animatedOpacity`, `animatedPositioned` | `duration`, `curve` | implicit animation timing (ms; named curve) | `__jsr_render` | `integer` (default 300), `curve` name (default `linear`) |
| `three` overlay | — | host-driven blur over the three canvas | `__jsrHostEvent('three.blur', payload)` → `jsr.three._hostEvent('blur', …)` | host event payload (three host contract) |

Units: lengths in logical px; `rotation`/`rotate`-in-`transform` in radians;
the top-level `rotate` prop in DEGREES. Alignment strings:
`topLeft, topCenter, topRight, centerLeft, center, centerRight, bottomLeft,
bottomCenter, bottomRight`.
