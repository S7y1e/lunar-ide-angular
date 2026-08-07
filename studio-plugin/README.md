# Lunar Studio Bridge

Streams Roblox Studio output (edit + play-test) into the Lunar IDE **Runtime** panel.

## Install

1. In Roblox Studio, open the **View → Command Bar** or any Script.
2. Paste the contents of [`LunarBridge.luau`](LunarBridge.luau) into a new **Script**.
3. Select the Script, then **Plugins → Save as Local Plugin**.
4. Enable **Game Settings → Security → Allow HTTP Requests**.

## Use

- Open a project in Lunar and select the **Runtime** view (pulse icon).
- The bridge listens on `http://127.0.0.1:34900`. Lunar starts it automatically.
- Output and errors from Studio stream live into the panel; stack locations
  become clickable links to the source. The header shows a **▶ Play-test** chip
  while a play-test is running.

## Updating

If you change `LunarBridge.luau`, re-save it as a local plugin (same steps) to
pick up the new version.

The port is fixed at `34900` in both the plugin and the Rust bridge
(`src-tauri/src/runtime.rs`).
