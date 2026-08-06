// Figma node tree -> normalized Roblox UI tree. Class is auto-inferred from the
// Figma node type; `@ClassName` in the layer name overrides it.

import {
    isTextClass,
    type FigmaFill,
    type FigmaNode,
    type FigmaStyle,
    type RobloxClass,
    type Rect,
    type UiNode,
    type UiProps,
} from "./figma-types";
import { parseName } from "./naming";

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
    return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function solidFill(fills?: FigmaFill[]): FigmaFill | undefined {
    return fills?.find((f) => f.visible !== false && f.type === "SOLID" && f.color);
}

function hasImageFill(fills?: FigmaFill[]): boolean {
    return !!fills?.some((f) => f.visible !== false && f.type === "IMAGE");
}

// Linear-gradient axis direction -> UIGradient rotation in degrees.
function gradientAngle(t?: number[][]): number {
    if (!t || !t[0] || !t[1]) return 0;
    return Math.round((Math.atan2(t[1][0], t[0][0]) * 180) / Math.PI);
}

// Roblox built-in font family files are the family name in PascalCase with spaces
// removed (e.g. "Fredoka One" -> FredokaOne.json), so we derive the file name and
// only need this table to remap web fonts Roblox lacks to the closest built-in.
// A wrong guess is harmless: codegen sets FontFace under pcall, so it just falls
// back to the default font instead of erroring.
const FONT_ALIASES: Record<string, string> = {
    inter: "BuilderSans",
    poppins: "Montserrat", // geometric sans, closest built-in
    "open sans": "SourceSansPro",
    "source sans": "SourceSansPro",
    lato: "SourceSansPro",
    gotham: "BuilderSans",
    arial: "Arimo",
    helvetica: "Arimo",
};
function familyFile(family?: string): string {
    const key = (family ?? "").toLowerCase().trim();
    if (FONT_ALIASES[key]) return FONT_ALIASES[key];
    const derived = (family ?? "").replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "");
    return derived || "BuilderSans";
}
function mapFont(style?: FigmaStyle): NonNullable<UiProps["font"]> {
    const italic = style?.italic ?? /italic|oblique/i.test(style?.fontPostScriptName ?? "");
    return {
        family: `rbxasset://fonts/families/${familyFile(style?.fontFamily)}.json`,
        weight: style?.fontWeight ?? 400,
        italic,
    };
}

function buildProps(node: FigmaNode, cls: RobloxClass): UiProps {
    const p: UiProps = {};
    const isText = isTextClass(cls);
    const fill = solidFill(node.fills);

    if (isText) {
        p.backgroundTransparency = 1;
        if (node.characters !== undefined) p.text = node.characters;
        if (fill?.color) p.textColor = rgb(fill.color);
        if (node.style?.fontSize) p.textSize = Math.round(node.style.fontSize);
        p.font = mapFont(node.style);
        const a = node.style?.textAlignHorizontal;
        p.textXAlign = a === "CENTER" ? "Center" : a === "RIGHT" ? "Right" : "Left";
    } else if (fill?.color) {
        p.backgroundColor = rgb(fill.color);
        const a = fill.color.a ?? 1;
        if (a < 1) p.backgroundTransparency = +(1 - a).toFixed(2);
    } else {
        const gf = node.fills?.find((f) => f.visible !== false && f.type.startsWith("GRADIENT"));
        if (gf?.gradientStops && gf.gradientStops.length >= 2) {
            p.backgroundColor = [255, 255, 255]; // white so the UIGradient shows at full colour
            p.gradient = {
                stops: gf.gradientStops.map((s) => ({
                    pos: Math.min(1, Math.max(0, s.position)),
                    color: rgb(s.color),
                })),
                rotation: gradientAngle(gf.gradientTransform),
            };
        } else {
            p.backgroundTransparency = 1;
        }
    }

    const sp = node.strokes?.find(
        (f) => f.visible !== false && (f.type === "SOLID" || f.type.startsWith("GRADIENT")),
    );
    if (sp && node.strokeWeight) {
        const thickness = Math.max(1, Math.round(node.strokeWeight));
        const align =
            node.strokeAlign === "INSIDE"
                ? "Inner"
                : node.strokeAlign === "OUTSIDE"
                  ? "Outer"
                  : "Center";
        if (sp.type === "SOLID" && sp.color) {
            p.stroke = { thickness, align, color: rgb(sp.color) };
        } else if (sp.gradientStops && sp.gradientStops.length >= 2) {
            p.stroke = {
                thickness,
                align,
                gradient: {
                    stops: sp.gradientStops.map((s) => ({
                        pos: Math.min(1, Math.max(0, s.position)),
                        color: rgb(s.color),
                    })),
                    rotation: gradientAngle(sp.gradientTransform),
                },
            };
        } else if (sp.gradientStops?.[0]?.color) {
            p.stroke = { thickness, align, color: rgb(sp.gradientStops[0].color) }; // single stop -> solid
        }
    }

    if (node.clipsContent) p.clipsDescendants = true;
    if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
        p.cornerRadius = node.cornerRadius;
    } else if (node.rectangleCornerRadii?.some((x) => x > 0)) {
        const rr = node.rectangleCornerRadii;
        p.cornerRadii = [rr[0], rr[1], rr[2], rr[3]]; // per-corner for the preview
        p.cornerRadius = Math.max(...rr); // uniform approximation for Roblox UICorner
    }
    if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
        p.layout = {
            dir: node.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical",
            spacing: node.itemSpacing ?? 0,
        };
    }
    if (hasImageFill(node.fills)) p.hasImageFill = true;
    if (node.imageHash) p.imageHash = node.imageHash;
    return p;
}

function autoClass(node: FigmaNode): RobloxClass {
    if (node.type === "TEXT") return "TextLabel";
    if (hasImageFill(node.fills)) return "ImageLabel";
    if (node.interactions && (node.interactions as unknown[]).length > 0) return "ImageButton";
    return "Frame";
}

// Drops excluded nodes; `@Class` overrides auto-classification.
function mapNode(node: FigmaNode, parentBox?: Rect, isRoot = false): UiNode | null {
    const info = parseName(node.name);
    if (info.excluded) return null;

    const guess = info.bg ? "ImageLabel" : autoClass(node);
    const cls = info.forcedClass ?? (isRoot ? "Frame" : guess);
    const box = node.absoluteBoundingBox;
    const pos =
        box && parentBox
            ? { x: Math.round(box.x - parentBox.x), y: Math.round(box.y - parentBox.y) }
            : { x: 0, y: 0 };
    const size = box ? { w: Math.round(box.width), h: Math.round(box.height) } : { w: 0, h: 0 };
    const props = buildProps(node, cls);
    if (info.noClip) props.clipsDescendants = false;
    if (info.clip) props.clipsDescendants = true;
    return {
        id: node.id,
        name: info.name,
        figmaName: node.name,
        className: cls,
        guess,
        pos,
        size,
        props,
        children: info.bg
            ? []
            : (node.children ?? []).map((c) => mapNode(c, box)).filter((c): c is UiNode => c !== null),
    };
}

// Entry point: the root frame maps relative to itself (pos 0,0).
export function mapFigma(root: FigmaNode): UiNode | null {
    return mapNode(root, root.absoluteBoundingBox, true);
}
