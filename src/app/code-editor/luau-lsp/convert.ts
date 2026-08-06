import * as monaco from "monaco-editor";
import {
    type LspPosition,
    type LspRange,
    type LspLocationResult,
    type LspDocumentSymbol,
    type LspWorkspaceEdit,
    type LspTextEdit,
    type LspDiagnostic,
    type LspHover,
    type LspMarkup,
} from "./lsp-types";

export * from "./lsp-types";
export { toCompletionItem, toCompletionList, toSignatureHelp } from "./convert-completion";

export function toLspPosition(position: monaco.IPosition): LspPosition {
    return { line: position.lineNumber - 1, character: position.column - 1 };
}

function toRange(range: LspRange): monaco.IRange {
    return {
        startLineNumber: range.start.line + 1,
        startColumn: range.start.character + 1,
        endLineNumber: range.end.line + 1,
        endColumn: range.end.character + 1,
    };
}

export function toMonacoLocations(
    result: LspLocationResult
): monaco.languages.Location[] {
    if (!result) return [];
    const list = Array.isArray(result) ? result : [result];
    return list
        .map((loc) => {
            // Normalize Location and LocationLink into one shape.
            const uri = "uri" in loc ? loc.uri : loc.targetUri;
            const range =
                "range" in loc
                    ? loc.range
                    : loc.targetSelectionRange ?? loc.targetRange;
            if (!uri || !range) return null;
            return { uri: monaco.Uri.parse(uri), range: toRange(range) };
        })
        .filter((l): l is monaco.languages.Location => l !== null);
}

// LSP SymbolKind is 1-based; monaco.languages.SymbolKind is the same list 0-based.
function toDocumentSymbol(symbol: LspDocumentSymbol): monaco.languages.DocumentSymbol {
    return {
        name: symbol.name,
        detail: symbol.detail ?? "",
        kind: Math.max(0, (symbol.kind ?? 13) - 1),
        tags: [],
        range: toRange(symbol.range),
        selectionRange: toRange(symbol.selectionRange ?? symbol.range),
        children: symbol.children?.map(toDocumentSymbol),
    };
}

export function toDocumentSymbols(
    result: LspDocumentSymbol[] | null
): monaco.languages.DocumentSymbol[] {
    return result ? result.map(toDocumentSymbol) : [];
}

export function toWorkspaceEdit(edit: LspWorkspaceEdit): monaco.languages.WorkspaceEdit {
    const edits: monaco.languages.IWorkspaceTextEdit[] = [];
    const push = (uri: string, textEdits: LspTextEdit[]) => {
        for (const te of textEdits) {
            edits.push({
                resource: monaco.Uri.parse(uri),
                textEdit: { range: toRange(te.range), text: te.newText },
                versionId: undefined,
            });
        }
    };
    if (edit?.changes) {
        for (const uri of Object.keys(edit.changes)) push(uri, edit.changes[uri]);
    }
    for (const dc of edit?.documentChanges ?? []) {
        push(dc.textDocument.uri, dc.edits);
    }
    return { edits };
}

const SEVERITY: Record<number, monaco.MarkerSeverity> = {
    1: monaco.MarkerSeverity.Error,
    2: monaco.MarkerSeverity.Warning,
    3: monaco.MarkerSeverity.Info,
    4: monaco.MarkerSeverity.Hint,
};

export function toMarker(d: LspDiagnostic): monaco.editor.IMarkerData {
    return {
        severity: SEVERITY[d.severity ?? 1] ?? monaco.MarkerSeverity.Error,
        message: d.message,
        source: d.source,
        startLineNumber: d.range.start.line + 1,
        startColumn: d.range.start.character + 1,
        endLineNumber: d.range.end.line + 1,
        endColumn: d.range.end.character + 1,
    };
}

function markupToString(markup: LspMarkup): string {
    if (typeof markup === "string") return markup;
    if (markup.language) {
        return "```" + markup.language + "\n" + markup.value + "\n```";
    }
    return markup.value ?? "";
}

export function toHover(result: LspHover): monaco.languages.Hover | null {
    if (!result) return null;
    const parts = Array.isArray(result.contents) ? result.contents : [result.contents];
    const contents = parts
        .map(markupToString)
        .filter((value) => value.length > 0)
        .map((value) => ({ value }));
    if (contents.length === 0) return null;
    const range = result.range
        ? {
              startLineNumber: result.range.start.line + 1,
              startColumn: result.range.start.character + 1,
              endLineNumber: result.range.end.line + 1,
              endColumn: result.range.end.character + 1,
          }
        : undefined;
    return { contents, range };
}
