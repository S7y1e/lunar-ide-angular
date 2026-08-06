import type * as monaco from 'monaco-editor';

export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
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
