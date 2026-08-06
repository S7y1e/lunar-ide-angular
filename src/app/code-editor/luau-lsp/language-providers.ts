import * as monaco from "monaco-editor";
import { LuauLspClient } from "./client";
import {
    toLspPosition,
    toCompletionList,
    toCompletionItem,
    toHover,
    toMonacoLocations,
    toDocumentSymbols,
    toWorkspaceEdit,
    toSignatureHelp,
} from "./convert";
import type { LspCompletionItem, LspDiagnostic } from "./convert";
import { toInlayHints, toDocumentHighlights, toCodeActions } from "./convert-actions";
import { sanitizeSemanticTokens } from "./semantic-tokens";

function toLspRange(range: monaco.IRange) {
    return {
        start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
        end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
    };
}

// Register every Monaco language feature for one language id, each backed by a
// request to the luau-lsp client and converted into Monaco's shapes.
export function registerProviders(
    client: LuauLspClient,
    language: string
): monaco.IDisposable[] {
    return [
        monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: [".", ":", "'", '"', "/"],
            async provideCompletionItems(model, position) {
                const result = await client.completion(
                    model.uri.toString(),
                    toLspPosition(position)
                );
                return toCompletionList(result, model, position);
            },
            async resolveCompletionItem(item) {
                const lspItem = (item as monaco.languages.CompletionItem & { data?: LspCompletionItem }).data;
                if (!lspItem) return item;
                try {
                    const resolved = await client.completionResolve(lspItem);
                    if (!resolved.additionalTextEdits?.length) return item;
                    return toCompletionItem(resolved, item.range as monaco.IRange);
                } catch {
                    return item;
                }
            },
        }),

        monaco.languages.registerHoverProvider(language, {
            async provideHover(model, position) {
                const result = await client.hover(model.uri.toString(), toLspPosition(position));
                return toHover(result);
            },
        }),

        monaco.languages.registerDefinitionProvider(language, {
            async provideDefinition(model, position) {
                const result = await client.definition(model.uri.toString(), toLspPosition(position));
                return toMonacoLocations(result);
            },
        }),

        monaco.languages.registerReferenceProvider(language, {
            async provideReferences(model, position) {
                const result = await client.references(model.uri.toString(), toLspPosition(position));
                return toMonacoLocations(result);
            },
        }),

        monaco.languages.registerDocumentSymbolProvider(language, {
            async provideDocumentSymbols(model) {
                const result = await client.documentSymbols(model.uri.toString());
                return toDocumentSymbols(result);
            },
        }),

        monaco.languages.registerRenameProvider(language, {
            async provideRenameEdits(model, position, newName) {
                const result = await client.rename(
                    model.uri.toString(),
                    toLspPosition(position),
                    newName
                );
                return toWorkspaceEdit(result);
            },
        }),

        monaco.languages.registerSignatureHelpProvider(language, {
            signatureHelpTriggerCharacters: ["(", ","],
            async provideSignatureHelp(model, position) {
                const result = await client.signatureHelp(model.uri.toString(), toLspPosition(position));
                return toSignatureHelp(result);
            },
        }),

        monaco.languages.registerInlayHintsProvider(language, {
            async provideInlayHints(model, range) {
                const result = await client.inlayHint(model.uri.toString(), toLspRange(range));
                return { hints: toInlayHints(result), dispose() {} };
            },
        }),

        monaco.languages.registerDocumentHighlightProvider(language, {
            async provideDocumentHighlights(model, position) {
                const result = await client.documentHighlight(
                    model.uri.toString(),
                    toLspPosition(position)
                );
                return toDocumentHighlights(result);
            },
        }),

        monaco.languages.registerCodeActionProvider(language, {
            async provideCodeActions(model, range, context) {
                const diagnostics = context.markers.map(
                    (m): LspDiagnostic => ({
                        range: toLspRange(m),
                        severity: m.severity,
                        message: m.message,
                        source: m.source,
                    })
                );
                const result = await client.codeAction(
                    model.uri.toString(),
                    toLspRange(range),
                    diagnostics
                );
                return { actions: toCodeActions(result), dispose() {} };
            },
        }),

        monaco.languages.registerDocumentSemanticTokensProvider(language, {
            getLegend() {
                return client.semanticTokensLegend() ?? { tokenTypes: [], tokenModifiers: [] };
            },
            async provideDocumentSemanticTokens(model) {
                const result = await client.semanticTokensFull(model.uri.toString());
                // The model can be disposed during the await (file closed/switched);
                // touching it then throws "Model is disposed!".
                if (!result?.data || model.isDisposed()) return null;
                return { data: sanitizeSemanticTokens(result.data, model) };
            },
            releaseDocumentSemanticTokens() {},
        }),
    ];
}
