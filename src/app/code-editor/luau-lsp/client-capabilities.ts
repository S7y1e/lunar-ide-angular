// Static LSP client capabilities sent in `initialize`. Lifted out of the client
// so the lifecycle logic stays readable.
export function clientCapabilities() {
    return {
        textDocument: {
            synchronization: { dynamicRegistration: false },
            publishDiagnostics: { relatedInformation: true },
            completion: {
                contextSupport: true,
                completionItem: {
                    snippetSupport: true,
                    documentationFormat: ["markdown", "plaintext"],
                    resolveSupport: {
                        properties: ["additionalTextEdits", "documentation", "detail"],
                    },
                },
            },
            hover: { contentFormat: ["markdown", "plaintext"] },
            definition: { dynamicRegistration: false, linkSupport: true },
            inlayHint: { dynamicRegistration: false },
            documentHighlight: { dynamicRegistration: false },
            codeAction: {
                dynamicRegistration: false,
                codeActionLiteralSupport: {
                    codeActionKind: {
                        valueSet: ["quickfix", "refactor", "source"],
                    },
                },
            },
            semanticTokens: {
                dynamicRegistration: false,
                requests: { range: false, full: { delta: false } },
                tokenTypes: [
                    "namespace", "type", "class", "enum", "interface", "struct",
                    "typeParameter", "parameter", "variable", "property", "enumMember",
                    "event", "function", "method", "macro", "keyword", "modifier",
                    "comment", "string", "number", "regexp", "operator", "decorator",
                ],
                tokenModifiers: [
                    "declaration", "definition", "readonly", "static", "deprecated",
                    "abstract", "async", "modification", "documentation", "defaultLibrary",
                ],
                formats: ["relative"],
                overlappingTokenSupport: false,
                multilineTokenSupport: false,
            },
        },
        workspace: {
            configuration: true,
            didChangeConfiguration: { dynamicRegistration: false },
            didChangeWatchedFiles: { dynamicRegistration: true },
            workspaceFolders: true,
        },
    };
}
