// Shapes of the LSP payloads luau-lsp returns, decoded into Monaco by the
// `convert*` modules.
export type LspPosition = { line: number; character: number };
export type LspRange = { start: LspPosition; end: LspPosition };

export type LspDiagnostic = {
    range: LspRange;
    severity?: number;
    message: string;
    source?: string;
    code?: string | number;
};

export type LspDocumentation = string | { kind?: string; value: string } | undefined;

export type LspTextEdit = {
    range: LspRange;
    newText: string;
};

export type LspCompletionItem = {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: LspDocumentation;
    insertText?: string;
    insertTextFormat?: number;
    sortText?: string;
    filterText?: string;
    additionalTextEdits?: LspTextEdit[];
    data?: unknown;
};

export type LspCompletionResult =
    | LspCompletionItem[]
    | { items: LspCompletionItem[] }
    | null;

export type LspMarkup = string | { language?: string; kind?: string; value: string };

export type LspHover = {
    contents: LspMarkup | LspMarkup[];
    range?: LspRange;
} | null;

export type LspLocation = { uri: string; range: LspRange };
// Servers may answer go-to-definition with LocationLink instead of Location
// (luau-lsp does this for requires), which names its fields differently.
export type LspLocationLink = {
    targetUri: string;
    targetRange: LspRange;
    targetSelectionRange?: LspRange;
};
// definition/references can return a single Location, a list, or null.
export type LspLocationResult =
    | LspLocation
    | LspLocation[]
    | LspLocationLink[]
    | null;

export type LspDocumentSymbol = {
    name: string;
    detail?: string;
    kind: number;
    range: LspRange;
    selectionRange: LspRange;
    children?: LspDocumentSymbol[];
};

export type LspWorkspaceEdit = {
    changes?: { [uri: string]: LspTextEdit[] };
    documentChanges?: { textDocument: { uri: string }; edits: LspTextEdit[] }[];
} | null;

export type LspParameter = { label: string | [number, number]; documentation?: LspDocumentation };
export type LspSignature = {
    label: string;
    documentation?: LspDocumentation;
    parameters?: LspParameter[];
};
export type LspSignatureHelp = {
    signatures: LspSignature[];
    activeSignature?: number;
    activeParameter?: number;
} | null;

export type LspInlayHintLabelPart = { value: string };
export type LspInlayHint = {
    position: LspPosition;
    label: string | LspInlayHintLabelPart[];
    kind?: number;
    paddingLeft?: boolean;
    paddingRight?: boolean;
    textEdits?: LspTextEdit[];
};

export type LspDocumentHighlight = { range: LspRange; kind?: number };

export type LspCommand = { title: string; command: string; arguments?: unknown[] };
export type LspCodeAction = {
    title: string;
    kind?: string;
    diagnostics?: LspDiagnostic[];
    edit?: LspWorkspaceEdit;
    command?: LspCommand;
    isPreferred?: boolean;
};
export type LspCodeActionResult = (LspCodeAction | LspCommand)[] | null;
