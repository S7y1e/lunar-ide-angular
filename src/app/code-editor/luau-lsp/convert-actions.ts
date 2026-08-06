import * as monaco from "monaco-editor";
import { toWorkspaceEdit } from "./convert";
import type {
    LspRange,
    LspInlayHint,
    LspDocumentHighlight,
    LspCodeActionResult,
    LspCodeAction,
} from "./lsp-types";

function toRange(range: LspRange): monaco.IRange {
    return {
        startLineNumber: range.start.line + 1,
        startColumn: range.start.character + 1,
        endLineNumber: range.end.line + 1,
        endColumn: range.end.character + 1,
    };
}

export function toInlayHints(
    result: LspInlayHint[] | null
): monaco.languages.InlayHint[] {
    if (!result) return [];
    return result.map((h) => ({
        position: { lineNumber: h.position.line + 1, column: h.position.character + 1 },
        label: typeof h.label === "string" ? h.label : h.label.map((p) => p.value).join(""),
        kind: h.kind as monaco.languages.InlayHintKind | undefined,
        paddingLeft: h.paddingLeft,
        paddingRight: h.paddingRight,
    }));
}

// LSP DocumentHighlightKind (Text=1, Read=2, Write=3) -> Monaco (Text=0, Read=1, Write=2).
export function toDocumentHighlights(
    result: LspDocumentHighlight[] | null
): monaco.languages.DocumentHighlight[] {
    if (!result) return [];
    return result.map((h) => ({
        range: toRange(h.range),
        kind: ((h.kind ?? 1) - 1) as monaco.languages.DocumentHighlightKind,
    }));
}

const isCodeAction = (item: LspCodeAction | { command: string }): item is LspCodeAction =>
    typeof (item as { command?: unknown }).command !== "string";

export function toCodeActions(
    result: LspCodeActionResult
): monaco.languages.CodeAction[] {
    if (!result) return [];
    // Only surface actions that carry a workspace edit; command-only actions
    // would need a registered Monaco command to do anything.
    return result
        .filter(isCodeAction)
        .filter((a) => a.edit)
        .map((a) => ({
            title: a.title,
            kind: a.kind,
            isPreferred: a.isPreferred,
            edit: toWorkspaceEdit(a.edit ?? null),
        }));
}
