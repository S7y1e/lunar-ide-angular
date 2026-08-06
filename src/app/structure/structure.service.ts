import { Injectable, effect, inject, signal } from '@angular/core';
import * as monaco from 'monaco-editor';
import { getCurrentLspClient } from '../code-editor/luau-lsp/lsp-registry';
import { pathToUri } from '../core/monaco-uri';
import type { LspDocumentSymbol } from '../code-editor/luau-lsp/convert';
import { EditorGroupsService } from '../core/editor-groups.service';

// The active file's document symbols (functions/fields/…), kept live by
// re-querying the LSP when the editor content changes.
@Injectable({ providedIn: 'root' })
export class StructureService {
    private readonly editorGroups = inject(EditorGroupsService);

    readonly symbols = signal<LspDocumentSymbol[]>([]);

    private alive = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private retry: ReturnType<typeof setTimeout> | undefined;
    private contentSub?: monaco.IDisposable;

    constructor() {
        effect(() => {
            const activeFile = this.editorGroups.activeFile();
            this.watch(activeFile);
        });
    }

    private watch(activeFile: string | null): void {
        this.teardown();
        if (!activeFile) {
            this.symbols.set([]);
            return;
        }
        const uri = pathToUri(activeFile);
        const token = ++this.alive;

        const fetch = () => {
            const client = getCurrentLspClient();
            if (!client) return;
            client
                .documentSymbols(uri)
                .then((s) => {
                    if (token === this.alive) this.symbols.set(s ?? []);
                })
                .catch(() => {});
        };

        fetch();
        // Late start: the LSP/model may not be ready on the first tick.
        this.retry = setTimeout(fetch, 600);

        const model = monaco.editor.getModel(monaco.Uri.parse(uri));
        this.contentSub = model?.onDidChangeContent(() => {
            clearTimeout(this.timer);
            this.timer = setTimeout(fetch, 400);
        });
    }

    private teardown(): void {
        this.alive++;
        clearTimeout(this.timer);
        clearTimeout(this.retry);
        this.contentSub?.dispose();
        this.contentSub = undefined;
    }
}
