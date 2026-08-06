// Layer name -> sanitized Roblox Instance.Name + directives baked into the name.
// Multiple directives can be chained: "Card@ImageLabel@noclip@bg"
//
//   @Frame/@ImageLabel/etc.  — force Roblox class
//   @scroll                  — shorthand for @ScrollingFrame
//   @canvas                  — shorthand for @CanvasGroup
//   @exclude / _prefix       — drop node entirely (hidden + not recreated)
//   @ignore                  — bake into parent PNG, don't create own instance
//   @noclip                  — force ClipsDescendants = false
//   @clip                    — force ClipsDescendants = true
//   @bg                      — bake all children into the PNG (no overlays extracted)

import type { RobloxClass } from "./figma-types";

export interface NameInfo {
    name: string;
    forcedClass?: RobloxClass;
    excluded: boolean;
    noClip?: boolean;
    clip?: boolean;
    bg?: boolean;
}

const CLASS_TOKENS: Record<string, RobloxClass> = {
    frame: "Frame",
    scrollingframe: "ScrollingFrame",
    scroll: "ScrollingFrame",
    canvasgroup: "CanvasGroup",
    canvas: "CanvasGroup",
    textlabel: "TextLabel",
    textbutton: "TextButton",
    textbox: "TextBox",
    imagelabel: "ImageLabel",
    imagebutton: "ImageButton",
    viewportframe: "ViewportFrame",
};

function sanitize(s: string): string {
    const parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean);
    let out = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join("");
    if (/^[0-9]/.test(out)) out = "_" + out;
    return out || "Node";
}

export function parseName(raw: string): NameInfo {
    const info: NameInfo = { name: "Node", excluded: false };
    const s = raw.trim();
    if (s.startsWith("_")) info.excluded = true;

    const segs = s.split("@");
    for (const tok of segs.slice(1)) {
        const t = tok.trim().toLowerCase();
        if (t === "exclude" || t === "ignore") info.excluded = true;
        else if (t === "noclip") info.noClip = true;
        else if (t === "clip") info.clip = true;
        else if (t === "bg") info.bg = true;
        else if (CLASS_TOKENS[t]) info.forcedClass = CLASS_TOKENS[t];
    }

    info.name = sanitize(segs[0]);
    return info;
}
