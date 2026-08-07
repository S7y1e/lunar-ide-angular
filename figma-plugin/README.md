# Lunar UI Export — Figma plugin

Reads the selected frame **locally** in Figma and sends it to the Lunar IDE
bridge (`http://localhost:34900/figma`). No REST API, no token, no rate limit.

## Install (development, free, no publishing)

1. Open the Figma **desktop** app (localhost needs the desktop app, not the browser).
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Pick `figma-plugin/manifest.json` from this repo.

## Use

1. Open the **Lunar IDE** app (the bridge listens on port 34900).
2. In Figma, **select a frame**.
3. Run **Plugins → Development → Lunar UI Export** → click **Send to selected frame to Lunar**.
4. The Lunar IDE opens the visual preview of the mapped UI. Review, then **Send to Studio**.

## Notes

- Same data shape as the REST path, so the IDE mapper/codegen/preview are unchanged.
- If it says "Lunar not reachable", make sure the Lunar IDE app is running.
