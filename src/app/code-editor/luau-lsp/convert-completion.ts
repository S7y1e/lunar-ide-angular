import * as monaco from "monaco-editor";
import {
    type LspCompletionItem,
    type LspCompletionResult,
    type LspDocumentation,
    type LspSignatureHelp,
    type LspTextEdit,
} from "./lsp-types";

const COMPLETION_KIND: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
};

export function docToMarkdown(
    doc: LspDocumentation
): monaco.IMarkdownString | string | undefined {
    if (!doc) return undefined;
    if (typeof doc === "string") return doc;
    return { value: doc.value };
}

function lspEditToMonaco(edit: LspTextEdit): monaco.languages.TextEdit {
    return {
        range: {
            startLineNumber: edit.range.start.line + 1,
            startColumn: edit.range.start.character + 1,
            endLineNumber: edit.range.end.line + 1,
            endColumn: edit.range.end.character + 1,
        },
        text: edit.newText,
    };
}

export function toCompletionItem(
    item: LspCompletionItem,
    range: monaco.IRange
): monaco.languages.CompletionItem {
    return {
        label: item.label,
        kind:
            COMPLETION_KIND[item.kind ?? 1] ??
            monaco.languages.CompletionItemKind.Text,
        insertText: item.insertText ?? item.label,
        insertTextRules:
            item.insertTextFormat === 2
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
        detail: item.detail,
        documentation: docToMarkdown(item.documentation),
        sortText: item.sortText,
        filterText: item.filterText,
        additionalTextEdits: item.additionalTextEdits?.map(lspEditToMonaco),
        // carry LSP item data so resolveCompletionItem can forward it
        data: item,
        range,
    } as monaco.languages.CompletionItem & { data: LspCompletionItem };
}

export function toCompletionList(
    result: LspCompletionResult,
    model: monaco.editor.ITextModel,
    position: monaco.IPosition
): monaco.languages.CompletionList {
    const items = Array.isArray(result) ? result : result?.items ?? [];
    const word = model.getWordUntilPosition(position);
    const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    };
    return { suggestions: items.map((item) => toCompletionItem(item, range)) };
}

export function toSignatureHelp(
    result: LspSignatureHelp
): monaco.languages.SignatureHelpResult | null {
    if (!result?.signatures?.length) return null;
    return {
        value: {
            signatures: result.signatures.map((sig) => ({
                label: sig.label,
                documentation: docToMarkdown(sig.documentation),
                parameters: (sig.parameters ?? []).map((p) => ({
                    label: p.label,
                    documentation: docToMarkdown(p.documentation),
                })),
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
        },
        dispose() {},
    };
}
