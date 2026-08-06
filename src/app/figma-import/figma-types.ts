// Minimal Figma REST node shape (only the fields the mapper reads) plus the
// normalized Roblox UI tree it produces. Pure data; no network.

export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export interface FigmaFill {
    type: string; // SOLID | IMAGE | GRADIENT_* | ...
    visible?: boolean;
    opacity?: number;
    color?: FigmaColor;
    gradientStops?: { position: number; color: FigmaColor }[];
    gradientTransform?: number[][]; // [[a,b,tx],[c,d,ty]] — gradient axis direction
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FigmaStyle {
    fontFamily?: string;
    fontPostScriptName?: string; // e.g. "Montserrat-BoldItalic" — used to detect italic
    fontWeight?: number; // 100-900
    italic?: boolean;
    fontSize?: number;
    textAlignHorizontal?: string; // LEFT | CENTER | RIGHT | JUSTIFIED
}

export interface FigmaNode {
    id: string;
    name: string;
    type: string;
    children?: FigmaNode[];
    absoluteBoundingBox?: Rect;
    fills?: FigmaFill[];
    strokes?: FigmaFill[];
    strokeWeight?: number;
    strokeAlign?: string; // INSIDE | OUTSIDE | CENTER
    clipsContent?: boolean;
    cornerRadius?: number;
    rectangleCornerRadii?: number[];
    characters?: string;
    style?: FigmaStyle;
    layoutMode?: string; // HORIZONTAL | VERTICAL | NONE
    itemSpacing?: number;
    interactions?: unknown[]; // prototype reactions => button signal
    imageHash?: string; // set by the Figma plugin when it exported this node as PNG
}

export type RobloxClass =
    | "Frame"
    | "ScrollingFrame"
    | "CanvasGroup"
    | "TextLabel"
    | "TextButton"
    | "TextBox"
    | "ImageLabel"
    | "ImageButton"
    | "ViewportFrame";

export interface UiProps {
    backgroundColor?: [number, number, number]; // 0-255
    backgroundTransparency?: number;
    gradient?: { stops: { pos: number; color: [number, number, number] }[]; rotation: number };
    clipsDescendants?: boolean;
    cornerRadius?: number; // uniform (also = max of cornerRadii, for Roblox UICorner)
    cornerRadii?: [number, number, number, number]; // per-corner TL,TR,BR,BL (preview only)
    stroke?: {
        thickness: number;
        align?: "Inner" | "Outer" | "Center";
        color?: [number, number, number];
        gradient?: { stops: { pos: number; color: [number, number, number] }[]; rotation: number };
    };
    text?: string;
    textColor?: [number, number, number];
    textSize?: number;
    font?: { family: string; weight: number; italic: boolean }; // family = rbxasset font URI
    textXAlign?: "Left" | "Center" | "Right";
    layout?: { dir: "Horizontal" | "Vertical"; spacing: number };
    hasImageFill?: boolean; // needs a placeholder image; filled in the asset pass
    imageHash?: string; // exported PNG hash -> tag the instance so upload can fill it
}

export interface UiNode {
    id: string; // figma node id
    name: string; // sanitized Roblox Instance.Name
    figmaName: string; // original Figma layer name (for the review UI)
    className: RobloxClass; // current (possibly user-overridden) class
    guess: RobloxClass; // original heuristic guess, for Reset in the review UI
    pos: { x: number; y: number }; // offset px, relative to parent
    size: { w: number; h: number };
    props: UiProps;
    children: UiNode[];
}

export const isTextClass = (cls: string): boolean =>
    cls === "TextLabel" || cls === "TextButton" || cls === "TextBox";

export const isImageClass = (cls: string): boolean =>
    cls === "ImageLabel" || cls === "ImageButton";
