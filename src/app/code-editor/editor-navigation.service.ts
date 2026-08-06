import { Injectable, inject, signal } from '@angular/core';
import * as monaco from 'monaco-editor';
import { EditorGroupsService } from '../core/editor-groups.service';
import { ActiveEditorService } from './active-editor.service';
import { canonicalPath, pathToUri, uriToPath } from '../core/monaco-uri';
import { ProjectService } from '../core/project.service';
import { toRelative } from '../core/path';
import { ToastsService } from '../notifications/toasts.service';

export type CallTarget = { name: string };
export type UsageTarget = { kind?: 'member'; fromFile: string; receiver: string; member: string } | { kind: 'requirers'; file: string };

// Angular port of use-editor-navigation.ts.
@Injectable({ providedIn: 'root' })
export class EditorNavigationService {
    private readonly editorGroups = inject(EditorGroupsService);
    private readonly activeEditor = inject(ActiveEditorService);
    private readonly project = inject(ProjectService);
    private readonly toasts = inject(ToastsService);

    readonly callTarget = signal<CallTarget | null>(null);
    readonly usageTarget = signal<UsageTarget | null>(null);

    constructor() {
        // Cross-file navigation for LSP go-to-definition / find-references: the
        // standalone Monaco editor can't open another file on its own, so route
        // its open requests through EditorGroupsService + reveal.
        monaco.editor.registerEditorOpener({
            openCodeEditor: (_source, resource, selectionOrPosition) => {
                const file = canonicalPath(uriToPath(resource.toString()));
                this.editorGroups.openFile(file);
                const line =
                    selectionOrPosition && 'lineNumber' in selectionOrPosition
                        ? selectionOrPosition.lineNumber
                        : ((selectionOrPosition as monaco.IRange | undefined)?.startLineNumber ?? 1);
                const column =
                    selectionOrPosition && 'column' in selectionOrPosition
                        ? selectionOrPosition.column
                        : ((selectionOrPosition as monaco.IRange | undefined)?.startColumn ?? 1);
                this.revealLine(file, line, column);
                return true;
            },
        });
    }

    // Reveal a line once Monaco has swapped to the target model — right after
    // openFile the model may not be loaded yet, so poll a few frames.
    revealLine(path: string, line: number, column = 1): void {
        const uri = pathToUri(path);
        const reveal = (attempt: number): void => {
            const editor = this.activeEditor.editor();
            if (editor?.getModel()?.uri.toString() === uri) {
                editor.revealLineInCenter(line);
                editor.setPosition({ lineNumber: line, column });
                editor.focus();
            } else if (attempt < 60) {
                requestAnimationFrame(() => reveal(attempt + 1));
            }
        };
        reveal(0);
    }

    // Jump the active editor to a line/column (used by the Structure outline).
    goToLine(line: number, column: number): void {
        const editor = this.activeEditor.editor();
        if (!editor) return;
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column });
        editor.focus();
    }

    // Open a project-search hit (relative path + line/column) and jump to it.
    async openFileAt(relFile: string, line: number, column: number): Promise<void> {
        await this.editorGroups.openFileAt(relFile);
        const abs = this.editorGroups.activeFile();
        if (abs) this.revealLine(abs, line, column);
    }

    // Open Call Hierarchy for the function name at the editor cursor. Returns
    // whether a target was set — the caller opens the panel only then.
    showCallHierarchy(): boolean {
        const editor = this.activeEditor.editor();
        const model = editor?.getModel();
        const pos = editor?.getPosition();
        const word = model && pos ? model.getWordAtPosition(pos)?.word : null;
        if (!word) {
            this.toasts.push('error', 'Put the cursor on a function first');
            return false;
        }
        this.callTarget.set({ name: word });
        return true;
    }

    // Find Usages of the module member at the cursor (precise, cross-module).
    showFindUsages(): boolean {
        const editor = this.activeEditor.editor();
        const model = editor?.getModel();
        const pos = editor?.getPosition();
        const w = model && pos ? model.getWordAtPosition(pos) : null;
        const activeFile = this.editorGroups.activeFile();
        const root = this.project.root();
        if (!model || !pos || !w || !activeFile || !root) {
            this.toasts.push('error', 'Put the cursor on a member first');
            return false;
        }
        const before = model.getLineContent(pos.lineNumber).slice(0, w.startColumn - 1);
        const receiver = before.match(/([A-Za-z_]\w*)\s*[.:]\s*$/)?.[1] ?? '';
        this.usageTarget.set({ fromFile: toRelative(root, activeFile), receiver, member: w.word });
        return true;
    }

    // Find which modules require the active module (reverse dependency edges).
    showRequirers(): boolean {
        const activeFile = this.editorGroups.activeFile();
        const root = this.project.root();
        if (!activeFile || !root) {
            this.toasts.push('error', 'Open a module first');
            return false;
        }
        this.usageTarget.set({ kind: 'requirers', file: toRelative(root, activeFile) });
        return true;
    }
}
