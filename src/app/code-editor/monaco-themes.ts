import * as monaco from "monaco-editor";

// One palette per theme → a full Monaco theme via the factory below. Keep the
// keys here in sync with src/themes.css and src/lib/theme.ts.

const SCROLLBAR = {
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff1f",
    "scrollbarSlider.hoverBackground": "#ffffff38",
    "scrollbarSlider.activeBackground": "#ffffff4a",
};

const SCROLLBAR_LIGHT = {
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#0000001f",
    "scrollbarSlider.hoverBackground": "#00000033",
    "scrollbarSlider.activeBackground": "#00000045",
};

type Palette = {
    fg: string;
    comment: string;
    keyword: string;
    operator: string;
    string: string;
    escape: string;
    number: string;
    constLang: string;
    type: string;
    func: string;
    param: string;
    paramItalic?: boolean;
    enumMember: string;
    decorator: string;
    delimiter: string;
    // editor surface
    bg: string;
    lineNumber: string;
    lineNumberActive: string;
    lineHighlight: string;
    cursor: string;
    selection: string;
    indent: string;
    indentActive: string;
    light?: boolean;
};

const hex = (c: string) => c.replace("#", "");

function themeData(p: Palette): monaco.editor.IStandaloneThemeData {
    const t = (token: string, color: string, fontStyle?: string) =>
        fontStyle
            ? { token, foreground: hex(color), fontStyle }
            : { token, foreground: hex(color) };
    return {
        base: p.light ? "vs" : "vs-dark",
        inherit: true,
        rules: [
            t("", p.fg),
            t("comment", p.comment, "italic"),
            t("keyword", p.keyword),
            t("keyword.control", p.keyword),
            t("string", p.string),
            t("string.escape", p.escape),
            t("number", p.number),
            t("constant", p.number),
            t("constant.language", p.constLang),
            t("type", p.type),
            t("type.identifier", p.type),
            t("identifier", p.fg),
            t("variable", p.fg),
            t("variable.predefined", p.type),
            t("delimiter", p.delimiter),
            t("operator", p.operator),
            // Semantic token types (from luau-lsp)
            t("function", p.func),
            t("method", p.func),
            t("macro", p.func),
            t("property", p.fg),
            t("parameter", p.param, p.paramItalic ? "italic" : undefined),
            t("class", p.type),
            t("interface", p.type),
            t("struct", p.type),
            t("enum", p.type),
            t("typeParameter", p.type),
            t("namespace", p.type),
            t("enumMember", p.enumMember),
            t("decorator", p.decorator),
        ],
        colors: {
            "editor.background": p.bg,
            "editor.foreground": p.fg,
            "editorLineNumber.foreground": p.lineNumber,
            "editorLineNumber.activeForeground": p.lineNumberActive,
            "editor.lineHighlightBackground": p.lineHighlight,
            "editor.lineHighlightBorder": "#00000000",
            "editorCursor.foreground": p.cursor,
            "editor.selectionBackground": p.selection,
            "editorIndentGuide.background": p.indent,
            "editorIndentGuide.activeBackground": p.indentActive,
            "editorIndentGuide.background1": p.indent,
            "editorIndentGuide.activeBackground1": p.indentActive,
            "editorRuler.foreground": p.indent,
            "editorGutter.background": p.bg,
            ...(p.light ? SCROLLBAR_LIGHT : SCROLLBAR),
        },
    };
}

const PALETTES: Record<string, Palette> = {
    luau: {
        fg: "#c9d1de", comment: "#6b7488", keyword: "#c79bf2", operator: "#8fa3c0",
        string: "#dcc98a", escape: "#e0b884", number: "#eba886", constLang: "#c79bf2",
        type: "#8fb8f0", func: "#57d6c0", param: "#d2c5a6", paramItalic: true,
        enumMember: "#eba886", decorator: "#e0b884", delimiter: "#737d91",
        bg: "#14161d", lineNumber: "#3b4150", lineNumberActive: "#c9d1de",
        lineHighlight: "#1b1f29", cursor: "#57d6c0", selection: "#283450",
        indent: "#20242e", indentActive: "#3b4150",
    },
    "luau-light": {
        light: true,
        fg: "#4b4636", comment: "#a59c86", keyword: "#7a3fb0", operator: "#5f6678",
        string: "#7c6a12", escape: "#a84d1a", number: "#a84d1a", constLang: "#7a3fb0",
        type: "#285fa0", func: "#0c715a", param: "#6f6240", paramItalic: true, enumMember: "#a84d1a",
        decorator: "#a84d1a", delimiter: "#9a937f",
        bg: "#f5edda", lineNumber: "#c2b896", lineNumberActive: "#4b4636",
        lineHighlight: "#ece3cd", cursor: "#0c715a", selection: "#e0d4ac",
        indent: "#e7ddc4", indentActive: "#c2b896",
    },
    nord: {
        fg: "#d8dee9", comment: "#616e88", keyword: "#81a1c1", operator: "#81a1c1",
        string: "#a3be8c", escape: "#ebcb8b", number: "#b48ead", constLang: "#81a1c1",
        type: "#8fbcbb", func: "#88c0d0", param: "#d8dee9", enumMember: "#b48ead",
        decorator: "#d08770", delimiter: "#eceff4",
        bg: "#2e3440", lineNumber: "#4c566a", lineNumberActive: "#d8dee9",
        lineHighlight: "#3b4252", cursor: "#d8dee9", selection: "#434c5e",
        indent: "#3b4252", indentActive: "#4c566a",
    },
    dracula: {
        fg: "#f8f8f2", comment: "#6272a4", keyword: "#ff79c6", operator: "#ff79c6",
        string: "#f1fa8c", escape: "#ff79c6", number: "#bd93f9", constLang: "#bd93f9",
        type: "#8be9fd", func: "#50fa7b", param: "#ffb86c", paramItalic: true,
        enumMember: "#bd93f9", decorator: "#50fa7b", delimiter: "#f8f8f2",
        bg: "#282a36", lineNumber: "#6272a4", lineNumberActive: "#f8f8f2",
        lineHighlight: "#343746", cursor: "#f8f8f2", selection: "#44475a",
        indent: "#343746", indentActive: "#6272a4",
    },
    "tokyo-night": {
        fg: "#c0caf5", comment: "#565f89", keyword: "#bb9af7", operator: "#89ddff",
        string: "#9ece6a", escape: "#e0af68", number: "#ff9e64", constLang: "#bb9af7",
        type: "#2ac3de", func: "#7aa2f7", param: "#e0af68", enumMember: "#ff9e64",
        decorator: "#7aa2f7", delimiter: "#c0caf5",
        bg: "#1a1b26", lineNumber: "#3b4261", lineNumberActive: "#c0caf5",
        lineHighlight: "#1f2335", cursor: "#c0caf5", selection: "#283457",
        indent: "#1f2335", indentActive: "#3b4261",
    },
    "one-dark": {
        fg: "#abb2bf", comment: "#5c6370", keyword: "#c678dd", operator: "#56b6c2",
        string: "#98c379", escape: "#56b6c2", number: "#d19a66", constLang: "#d19a66",
        type: "#e5c07b", func: "#61afef", param: "#abb2bf", enumMember: "#d19a66",
        decorator: "#61afef", delimiter: "#abb2bf",
        bg: "#282c34", lineNumber: "#495162", lineNumberActive: "#abb2bf",
        lineHighlight: "#2c313a", cursor: "#528bff", selection: "#3e4451",
        indent: "#2c313a", indentActive: "#495162",
    },
    "catppuccin-mocha": {
        fg: "#cdd6f4", comment: "#6c7086", keyword: "#cba6f7", operator: "#89dceb",
        string: "#a6e3a1", escape: "#f5c2e7", number: "#fab387", constLang: "#fab387",
        type: "#f9e2af", func: "#89b4fa", param: "#eba0ac", paramItalic: true,
        enumMember: "#fab387", decorator: "#89b4fa", delimiter: "#bac2de",
        bg: "#1e1e2e", lineNumber: "#45475a", lineNumberActive: "#cdd6f4",
        lineHighlight: "#2a2b3c", cursor: "#f5e0dc", selection: "#414559",
        indent: "#313244", indentActive: "#45475a",
    },
    "gruvbox-dark": {
        fg: "#ebdbb2", comment: "#928374", keyword: "#fb4934", operator: "#fe8019",
        string: "#b8bb26", escape: "#fe8019", number: "#d3869b", constLang: "#d3869b",
        type: "#fabd2f", func: "#b8bb26", param: "#ebdbb2", enumMember: "#d3869b",
        decorator: "#fabd2f", delimiter: "#ebdbb2",
        bg: "#282828", lineNumber: "#7c6f64", lineNumberActive: "#ebdbb2",
        lineHighlight: "#32302f", cursor: "#ebdbb2", selection: "#504945",
        indent: "#3c3836", indentActive: "#504945",
    },
    // Matches the Roblox Studio Script Editor color scheme 1:1 (Keyword,
    // String, Number, Function Name, Type, "nil"/Bool, Local Property, etc.).
    studio: {
        fg: "#d6d6da", comment: "#7a8a7a", keyword: "#7a9cbf", operator: "#bebec4",
        string: "#c9976b", escape: "#dbb98a", number: "#7fada0", constLang: "#bf8c7a",
        type: "#528bff", func: "#c9b27c", param: "#a8a8bf", paramItalic: true,
        enumMember: "#bf8c7a", decorator: "#d9b15c", delimiter: "#bebec4",
        bg: "#191a1f", lineNumber: "#3c3c42", lineNumberActive: "#d6d6da",
        lineHighlight: "#26262c", cursor: "#335fff", selection: "#3a3f4b",
        indent: "#2d2d32", indentActive: "#3c3c42",
    },
};

export function registerMonacoThemes(): void {
    for (const [name, palette] of Object.entries(PALETTES)) {
        monaco.editor.defineTheme(`lunar-${name}`, themeData(palette));
    }
}
