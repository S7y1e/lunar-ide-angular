# Figma Import

Lunar can import Figma frames directly into Roblox Studio
as native UI instances (Frame, TextLabel, ImageLabel, etc.) — no manual recreation needed.

To use it, install the **Lunar Figma plugin** (see [Installation](/installation)),
open a frame in Figma and send it via the plugin.
The frame appears in the **Figma** panel in Lunar with a live preview.
From there you can import it into Studio with a single click.

## Default mapping

Without any tag, Lunar picks the class from the Figma node:

- **Frames** and **Rectangles** become a native `Frame`.
- **Text** becomes a `TextLabel`.
- **Groups** and non-native shapes (vectors, stars, polygons, booleans) are
  flattened into a single image and become an `ImageLabel`.
- **Sections** are treated as plain containers (`Frame`).

## How to mark instances

Mark a layer's instance type with **@** after its name:
`<LayerName>@<ClassName>`, using the Roblox UI class name.

For example, `Avatar@ImageLabel` imports the layer as an `ImageLabel`.

> The class is required: a layer is only imported if its name carries an explicit
> `@Class`. The single exception is the root frame, which defaults to `Frame`.
> Layers with no class are dropped.

You can also use the tag without a layer name (e.g. `@Frame`) and Lunar assigns
a default name. Tags are **case-insensitive** and can be **chained**, e.g.
`Panel@Frame@Ignore`.

### Supported classes

| Tag                                | Roblox class                                                                             |
|------------------------------------|------------------------------------------------------------------------------------------|
| `@Frame`                           | [Frame](https://create.roblox.com/docs/reference/engine/classes/Frame)                   |
| `@ScrollingFrame` *(or `@scroll`)* | [ScrollingFrame](https://create.roblox.com/docs/reference/engine/classes/ScrollingFrame) |
| `@CanvasGroup` *(or `@canvas`)*    | [CanvasGroup](https://create.roblox.com/docs/reference/engine/classes/CanvasGroup)       |
| `@TextLabel`                       | [TextLabel](https://create.roblox.com/docs/reference/engine/classes/TextLabel)           |
| `@TextButton`                      | [TextButton](https://create.roblox.com/docs/reference/engine/classes/TextButton)         |
| `@TextBox`                         | [TextBox](https://create.roblox.com/docs/reference/engine/classes/TextBox)               |
| `@ImageLabel`                      | [ImageLabel](https://create.roblox.com/docs/reference/engine/classes/ImageLabel)         |
| `@ImageButton`                     | [ImageButton](https://create.roblox.com/docs/reference/engine/classes/ImageButton)       |
| `@ViewportFrame`                   | [ViewportFrame](https://create.roblox.com/docs/reference/engine/classes/ViewportFrame)   |

### Custom tags

| Tag                    | Effect                                                           |
|------------------------|------------------------------------------------------------------|
| `@Ignore` / `@exclude` | Skips the layer (not recreated).                                 |
| `_` prefix             | A name starting with `_` is also skipped.                        |
| `@bg`                  | Flattens the layer **and all its children** into a single image. |
| `@noclip`              | Forces `ClipsDescendants = false`.                               |
| `@clip`                | Forces `ClipsDescendants = true`.                                |

`@Ignore` is handy for helper layers — textures, guides, or pieces that belong to
a parent layer and shouldn't become their own instance. For example,
`Glow@Ignore` keeps a decorative layer in Figma but leaves it out of the import.