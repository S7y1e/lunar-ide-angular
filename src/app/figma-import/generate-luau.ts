// UiNode tree -> a Luau script that builds the UI and parents it in Studio.
// Sent over the runtime bridge as { type: "eval", code } so the plugin runs it.
//
// Coordinates are the exact Figma design pixels (offset) — same as the preview.
// "Scaled" mode adds ONE root UIScale that fits the design to the viewport, so the
// whole UI scales uniformly (text, corners, strokes, positions) and stays faithful.
// Emits a nested DATA table + a tiny recursive builder so large UIs don't blow
// Luau's 200-locals-per-scope limit. Images are placeholders; the upload pass fills
// them via the LunarImage attribute.

import { isTextClass, isImageClass, type UiNode } from "./figma-types";

export interface CodegenOptions {
    root: "ScreenGui" | "Frame";
    mode?: "Offset" | "Scaled"; // Offset = raw design px; Scaled = fit to viewport via UIScale
    parent?: string; // Luau expr for the root's parent; default StarterGui
}

function luauStr(s: string): string {
    return JSON.stringify(s); // double-quoted with \n/\" escapes — valid Luau
}

// Figma numeric weight -> nearest Enum.FontWeight name.
const WEIGHTS: [number, string][] = [
    [100, "Thin"],
    [200, "ExtraLight"],
    [300, "Light"],
    [400, "Regular"],
    [500, "Medium"],
    [600, "SemiBold"],
    [700, "Bold"],
    [800, "ExtraBold"],
    [900, "Heavy"],
];
function fontWeight(w: number): string {
    return WEIGHTS.reduce((best, cur) =>
        Math.abs(cur[0] - w) < Math.abs(best[0] - w) ? cur : best,
    )[1];
}

// spec = {"Class", {props}, {children}, {attributes}}
const BUILDER = [
    "local function build(s, parent)",
    "\tlocal i = Instance.new(s[1])",
    // FontFace throws on an unavailable family/weight; pcall it so one bad font
    // can't abort the whole build (the root is parented last).
    '\tif s[2] then for k, v in pairs(s[2]) do if k == "FontFace" then pcall(function() i.FontFace = v end) else i[k] = v end end end',
    "\tif s[4] then for k, v in pairs(s[4]) do i:SetAttribute(k, v) end end",
    "\tif s[3] then for _, c in ipairs(s[3]) do build(c, i) end end",
    "\ti.Parent = parent",
    "\treturn i",
    "end",
].join("\n\t");

export function generateLuau(tree: UiNode, opts: CodegenOptions): string {
    const scaled = opts.mode === "Scaled";
    const rgb = (c: [number, number, number]) => `Color3.fromRGB(${c[0]}, ${c[1]}, ${c[2]})`;

    // ColorSequence needs endpoints at 0 and 1; force the first/last stops there.
    const colorSeq = (stops: { pos: number; color: [number, number, number] }[]): string => {
        const kps = stops
            .map((st, i) => {
                const pos = i === 0 ? 0 : i === stops.length - 1 ? 1 : st.pos;
                return `ColorSequenceKeypoint.new(${+pos.toFixed(3)}, ${rgb(st.color)})`;
            })
            .join(", ");
        return `ColorSequence.new({${kps}})`;
    };

    const spec = (node: UiNode, parent: UiNode | null): string => {
        const props: string[] = [
            `Name = ${luauStr(node.name)}`,
            `Size = UDim2.fromOffset(${node.size.w}, ${node.size.h})`,
        ];
        if (parent) {
            props.push(`Position = UDim2.fromOffset(${node.pos.x}, ${node.pos.y})`);
        } else if (scaled) {
            props.push(`Position = UDim2.fromScale(0.5, 0.5)`); // center the scaled UI
            props.push(`AnchorPoint = Vector2.new(0.5, 0.5)`);
        }

        const p = node.props;
        if (isTextClass(node.className)) {
            if (p.text !== undefined) props.push(`Text = ${luauStr(p.text)}`);
            if (p.textColor) props.push(`TextColor3 = ${rgb(p.textColor)}`);
            if (p.textSize) props.push(`TextSize = ${p.textSize}`);
            if (p.font) {
                const style = p.font.italic ? "Italic" : "Normal";
                props.push(
                    `FontFace = Font.new(${luauStr(p.font.family)}, Enum.FontWeight.${fontWeight(p.font.weight)}, Enum.FontStyle.${style})`,
                );
            }
            if (p.textXAlign) props.push(`TextXAlignment = Enum.TextXAlignment.${p.textXAlign}`);
        }
        if (p.backgroundColor) props.push(`BackgroundColor3 = ${rgb(p.backgroundColor)}`);
        if (p.backgroundTransparency !== undefined)
            props.push(`BackgroundTransparency = ${p.backgroundTransparency}`);
        if (p.clipsDescendants) props.push(`ClipsDescendants = true`);
        if (isImageClass(node.className) && (p.imageHash || p.hasImageFill)) props.push(`Image = ""`);

        const kids: string[] = [];
        if (p.gradient)
            kids.push(
                `{"UIGradient", {Color = ${colorSeq(p.gradient.stops)}, Rotation = ${p.gradient.rotation}}}`,
            );
        if (p.cornerRadius)
            kids.push(`{"UICorner", {CornerRadius = UDim.new(0, ${p.cornerRadius})}}`);
        if (p.stroke) {
            const sk = p.stroke;
            const sp = [`Thickness = ${sk.thickness}`];
            if (sk.align) sp.push(`BorderStrokePosition = Enum.BorderStrokePosition.${sk.align}`);
            // UIStroke.Color defaults to black and MULTIPLIES the child UIGradient, so
            // a gradient stroke needs white here or the gradient renders black.
            if (sk.color) sp.push(`Color = ${rgb(sk.color)}`);
            else if (sk.gradient) sp.push(`Color = Color3.fromRGB(255, 255, 255)`);
            // UIGradient inside the UIStroke colours the border with the gradient.
            const strokeKids = sk.gradient
                ? `, {{"UIGradient", {Color = ${colorSeq(sk.gradient.stops)}, Rotation = ${sk.gradient.rotation}}}}`
                : "";
            kids.push(`{"UIStroke", {${sp.join(", ")}}${strokeKids}}`);
        }
        if (p.layout)
            kids.push(
                `{"UIListLayout", {FillDirection = Enum.FillDirection.${p.layout.dir}, Padding = UDim.new(0, ${p.layout.spacing})}}`,
            );
        for (const c of node.children) kids.push(spec(c, node));

        const attrs: string[] = [];
        if (p.imageHash) attrs.push(`LunarImage = ${luauStr(p.imageHash)}`);

        let tail = "";
        if (kids.length || attrs.length) tail += `, {${kids.join(", ")}}`;
        if (attrs.length) tail += `, {${attrs.join(", ")}}`;
        return `{${luauStr(node.className)}, {${props.join(", ")}}${tail}}`;
    };

    const rootSpec = spec(tree, null);
    const parentExpr = opts.parent ?? `game:GetService("StarterGui")`;

    const fit = scaled
        ? [
              `\tlocal _vp = (workspace.CurrentCamera and workspace.CurrentCamera.ViewportSize) or Vector2.new(1920, 1080)`,
              `\tlocal _s = Instance.new("UIScale")`,
              `\t_s.Scale = math.min(_vp.X / ${tree.size.w || 1}, _vp.Y / ${tree.size.h || 1}) * 0.95`,
              `\t_s.Parent = root`,
          ]
        : [];

    const clearOld = `\tlocal _old = ${parentExpr}:FindFirstChild(${luauStr(tree.name)})\n\tif _old then _old:Destroy() end`;

    if (opts.root === "ScreenGui") {
        return [
            "do",
            `\t${BUILDER}`,
            clearOld,
            `\tlocal sg = Instance.new("ScreenGui")`,
            `\tsg.Name = ${luauStr(tree.name)}`,
            `\tsg.ResetOnSpawn = false`,
            `\tsg.Parent = ${parentExpr}`,
            `\tlocal root = build(${rootSpec}, sg)`,
            ...fit,
            "end",
        ].join("\n");
    }
    return [
        "do",
        `\t${BUILDER}`,
        clearOld,
        `\tlocal root = build(${rootSpec}, ${parentExpr})`,
        ...fit,
        "end",
    ].join("\n");
}
