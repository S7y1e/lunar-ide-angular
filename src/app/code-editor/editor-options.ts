import type * as monaco from 'monaco-editor';

export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
    // Monaco caches its measured width/height at creation (or the last
    // explicit .layout() call) and never re-measures on its own otherwise —
    // without this, resizing the host container (e.g. dragging a panel, or
    // the window reaching its final size after mount) leaves lines clipped
    // at the stale width instead of relaying out. `@monaco-editor/react`
    // (used by the React app) wires this automatically; the raw
    // `monaco-editor` package used here needs it set explicitly.
    automaticLayout: true,
    minimap: { enabled: false },
    'semanticHighlighting.enabled': true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    fontLigatures: true,
    mouseWheelZoom: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    lineHeight: 20,
    smoothScrolling: true,
    lineNumbersMinChars: 4,
    lineDecorationsWidth: 25,
    glyphMargin: true,
    scrollBeyondLastLine: false,
    padding: { top: 6 },
    scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false,
    },
    guides: {
        indentation: true,
        highlightActiveIndentation: true,
        bracketPairs: false,
    },
    fixedOverflowWidgets: true,
};
