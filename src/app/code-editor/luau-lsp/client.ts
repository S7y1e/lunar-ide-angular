import type { UnwatchFn } from "@tauri-apps/plugin-fs";
import { LspConnection } from "./lsp-connection";
import { resolveSection } from "./config";
import { uriToPath } from "../../core/monaco-uri";
import { watchWorkspace } from "./file-watcher";
import { clientCapabilities } from "./client-capabilities";
import { fflagArgs } from "./fflag-args";
import {
    LspPosition,
    LspDiagnostic,
    LspCompletionResult,
    LspCompletionItem,
    LspHover,
    LspLocationResult,
    LspDocumentSymbol,
    LspWorkspaceEdit,
    LspSignatureHelp,
    LspInlayHint,
    LspDocumentHighlight,
    LspCodeActionResult,
    LspRange,
} from "./convert";

const SIDECAR = "binaries/luau-lsp";

export type DiagnosticsListener = (
    uri: string,
    diagnostics: LspDiagnostic[],
) => void;

export type SemanticTokensLegend = {
    tokenTypes: string[];
    tokenModifiers: string[];
};

export class LuauLspClient {
    private conn = new LspConnection();
    private versions = new Map<string, number>();
    private openDocs = new Map<string, string>();
    private resolveReady!: () => void;
    private ready = new Promise<void>(
        (resolve) => (this.resolveReady = resolve),
    );
    private semanticLegend: SemanticTokensLegend | null = null;
    private fileWatch: UnwatchFn | null = null;
    private fileWatchStarting = false;
    private stopped = false;

    onDiagnostics: DiagnosticsListener = () => {};

    constructor(
        private rootUri: string,
        private getConfig: () => Record<string, unknown>,
        private definitionsPaths: string[] = [],
    ) {}

    async start(): Promise<void> {
        const args = ["lsp", "--stdio"];
        for (const path of this.definitionsPaths)
            args.push("--definitions", path);
        args.push(...fflagArgs(this.getConfig()));
        console.log("[luau-lsp] spawning sidecar", args);
        await this.conn.start(SIDECAR, args);
        console.log("[luau-lsp] sidecar spawned, sending initialize");

        this.conn.onRequest("workspace/configuration", (params) => {
            const items =
                (params as { items?: { section?: string }[] }).items ?? [];
            const root = this.getConfig();
            return items.map((item) => resolveSection(root, item.section));
        });
        // luau-lsp asks to watch the sourcemap, .luaurc and *.luau via dynamic
        // registration. Honoring it is what keeps requires/diagnostics fresh
        // when files change outside the editor (Argon sync, git, an agent).
        this.conn.onRequest("client/registerCapability", (params) => {
            const regs =
                (params as { registrations?: { method?: string }[] })
                    .registrations ?? [];
            if (
                regs.some((r) => r.method === "workspace/didChangeWatchedFiles")
            ) {
                this.startFileWatch();
            }
            return null;
        });
        this.conn.onRequest("client/unregisterCapability", () => null);
        this.conn.onRequest("window/workDoneProgress/create", () => null);

        this.conn.onNotification(
            "textDocument/publishDiagnostics",
            (params) => {
                const p = params as {
                    uri: string;
                    diagnostics: LspDiagnostic[];
                };
                this.onDiagnostics(p.uri, p.diagnostics ?? []);
            },
        );
        this.conn.onNotification("window/logMessage", (params) =>
            console.log("[luau-lsp]", (params as { message?: string }).message),
        );
        this.conn.onNotification("window/showMessage", (params) =>
            console.log("[luau-lsp]", (params as { message?: string }).message),
        );

        const result = await this.conn.sendRequest("initialize", {
            processId: null,
            clientInfo: { name: "lunar-ide" },
            rootUri: this.rootUri,
            workspaceFolders: [{ uri: this.rootUri, name: "workspace" }],
            capabilities: clientCapabilities(),
        });
        console.log("[luau-lsp] initialized", result);

        const provider = (
            result as {
                capabilities?: {
                    semanticTokensProvider?: { legend?: SemanticTokensLegend };
                };
            }
        )?.capabilities?.semanticTokensProvider;
        this.semanticLegend = provider?.legend ?? null;

        this.conn.sendNotification("initialized", {});
        this.conn.sendNotification("workspace/didChangeConfiguration", {
            settings: this.getConfig(),
        });
        this.resolveReady();
    }

    /**
     * Start watching the workspace and forward file changes to the server so it
     * re-reads sources and reloads the sourcemap. Idempotent: the server may
     * register more than once, but we only ever keep a single watcher.
     */
    private startFileWatch(): void {
        if (this.fileWatch || this.fileWatchStarting || this.stopped) return;
        this.fileWatchStarting = true;
        const root = uriToPath(this.rootUri);
        watchWorkspace(root, (changes) => {
            this.conn.sendNotification("workspace/didChangeWatchedFiles", {
                changes,
            });
        })
            .then((unwatch) => {
                this.fileWatchStarting = false;
                // Lost the race with stop(): tear the fresh watcher down.
                if (this.stopped) unwatch();
                else this.fileWatch = unwatch;
            })
            .catch((e) => {
                this.fileWatchStarting = false;
                console.warn("[luau-lsp] workspace file watch failed", e);
            });
    }

    /**
     * Re-push configuration so the server re-pulls the latest values, then nudge
     * open documents so analysis-affecting settings (types/diagnostics/platform)
     * take effect immediately instead of waiting for the next edit or restart.
     */
    notifyConfigChanged(): void {
        this.ready.then(() => {
            this.conn.sendNotification("workspace/didChangeConfiguration", {
                settings: this.getConfig(),
            });
            // Let the server finish re-pulling config before we ask it to
            // re-analyze; messages are ordered, the delay just avoids racing the
            // configuration pull it issues back to us.
            setTimeout(() => this.refreshOpenDocuments(), 50);
        });
    }

    /**
     * After a rename regenerates the sourcemap: tell the server the sourcemap
     * changed (don't wait for the FS watcher), then once it has reloaded, force a
     * fresh analysis of open docs. A didChange with identical text is ignored by
     * the server, so we didClose+didOpen instead — equivalent to the user
     * deleting and retyping the require, which is the only thing that cleared the
     * stale "unresolved require" squiggle.
     */
    revalidate(): void {
        this.ready.then(() => {
            this.conn.sendNotification("workspace/didChangeWatchedFiles", {
                changes: [{ uri: `${this.rootUri}/sourcemap.json`, type: 2 }],
            });
            // Let the server finish reading the reloaded sourcemap before we ask
            // it to re-analyze; messages are ordered, the delay covers the async
            // file read.
            setTimeout(() => this.reopenOpenDocuments(), 300);
        });
    }

    /** Drop and re-add every open doc so the server re-analyzes from scratch. */
    private reopenOpenDocuments(): void {
        for (const [uri, text] of this.openDocs) {
            this.conn.sendNotification("textDocument/didClose", {
                textDocument: { uri },
            });
            this.versions.set(uri, 1);
            this.conn.sendNotification("textDocument/didOpen", {
                textDocument: { uri, languageId: "luau", version: 1, text },
            });
        }
    }

    /** Re-send the current text of every open doc to trigger a fresh analysis. */
    private refreshOpenDocuments(): void {
        for (const [uri, text] of this.openDocs) {
            const version = (this.versions.get(uri) ?? 1) + 1;
            this.versions.set(uri, version);
            this.conn.sendNotification("textDocument/didChange", {
                textDocument: { uri, version },
                contentChanges: [{ text }],
            });
        }
    }

    didOpen(uri: string, text: string): void {
        this.openDocs.set(uri, text);
        this.ready.then(() => {
            this.versions.set(uri, 1);
            this.conn.sendNotification("textDocument/didOpen", {
                textDocument: { uri, languageId: "luau", version: 1, text },
            });
        });
    }

    didChange(uri: string, text: string): void {
        this.openDocs.set(uri, text);
        this.ready.then(() => {
            const version = (this.versions.get(uri) ?? 1) + 1;
            this.versions.set(uri, version);
            this.conn.sendNotification("textDocument/didChange", {
                textDocument: { uri, version },
                contentChanges: [{ text }],
            });
        });
    }

    didClose(uri: string): void {
        this.versions.delete(uri);
        this.openDocs.delete(uri);
        this.ready.then(() =>
            this.conn.sendNotification("textDocument/didClose", {
                textDocument: { uri },
            }),
        );
    }

    async completion(
        uri: string,
        position: LspPosition,
    ): Promise<LspCompletionResult> {
        await this.ready;
        return this.conn.sendRequest("textDocument/completion", {
            textDocument: { uri },
            position,
        });
    }

    async completionResolve(
        item: LspCompletionItem,
    ): Promise<LspCompletionItem> {
        await this.ready;
        return this.conn.sendRequest("completionItem/resolve", item);
    }

    async hover(uri: string, position: LspPosition): Promise<LspHover> {
        await this.ready;
        return this.conn.sendRequest("textDocument/hover", {
            textDocument: { uri },
            position,
        });
    }

    async definition(uri: string, position: LspPosition): Promise<LspLocationResult> {
        await this.ready;
        return this.conn.sendRequest("textDocument/definition", {
            textDocument: { uri },
            position,
        });
    }

    async references(uri: string, position: LspPosition): Promise<LspLocationResult> {
        await this.ready;
        return this.conn.sendRequest("textDocument/references", {
            textDocument: { uri },
            position,
            context: { includeDeclaration: true },
        });
    }

    async documentSymbols(uri: string): Promise<LspDocumentSymbol[] | null> {
        await this.ready;
        return this.conn.sendRequest("textDocument/documentSymbol", {
            textDocument: { uri },
        });
    }

    async rename(
        uri: string,
        position: LspPosition,
        newName: string
    ): Promise<LspWorkspaceEdit> {
        await this.ready;
        return this.conn.sendRequest("textDocument/rename", {
            textDocument: { uri },
            position,
            newName,
        });
    }

    async signatureHelp(
        uri: string,
        position: LspPosition
    ): Promise<LspSignatureHelp> {
        await this.ready;
        return this.conn.sendRequest("textDocument/signatureHelp", {
            textDocument: { uri },
            position,
        });
    }

    async inlayHint(uri: string, range: LspRange): Promise<LspInlayHint[] | null> {
        await this.ready;
        return this.conn.sendRequest("textDocument/inlayHint", {
            textDocument: { uri },
            range,
        });
    }

    async documentHighlight(
        uri: string,
        position: LspPosition
    ): Promise<LspDocumentHighlight[] | null> {
        await this.ready;
        return this.conn.sendRequest("textDocument/documentHighlight", {
            textDocument: { uri },
            position,
        });
    }

    async codeAction(
        uri: string,
        range: LspRange,
        diagnostics: LspDiagnostic[]
    ): Promise<LspCodeActionResult> {
        await this.ready;
        return this.conn.sendRequest("textDocument/codeAction", {
            textDocument: { uri },
            range,
            context: { diagnostics },
        });
    }

    /** Legend reported by the server, needed to decode semantic token ids. */
    semanticTokensLegend(): SemanticTokensLegend | null {
        return this.semanticLegend;
    }

    async semanticTokensFull(uri: string): Promise<{ data: number[] } | null> {
        await this.ready;
        if (!this.semanticLegend) return null;
        return this.conn.sendRequest("textDocument/semanticTokens/full", {
            textDocument: { uri },
        });
    }

    async stop(): Promise<void> {
        this.stopped = true;
        this.fileWatch?.();
        this.fileWatch = null;
        try {
            await this.conn.sendRequest("shutdown");
        } catch {}
        this.conn.sendNotification("exit");
        await this.conn.stop();
    }
}
