import { Injectable, computed, inject, signal } from '@angular/core';
import { message } from '@tauri-apps/plugin-dialog';
import { FileNode } from './file-node';
import { renameEntry } from '../core/filesystem';
import { EditorGroupsService } from '../core/editor-groups.service';
import { ProjectService } from '../core/project.service';
import { buildRenamePlanForFile, applyRenamePlan } from '../refactor/rename-module';

// Angular port of file-tree/tree-selection.ts + code-editor/use-rename-node.ts,
// combined into one root-scoped service since the app has exactly one file
// tree — this stands in for React's TreeSelectionContext.Provider.
@Injectable({ providedIn: 'root' })
export class FileTreeSelectionService {
    private readonly editorGroups = inject(EditorGroupsService);
    private readonly project = inject(ProjectService);

    readonly selected = signal<string | null>(null);
    // Active editor file, so the tree can auto-expand to it and highlight it.
    readonly revealPath = computed(() => this.editorGroups.activeFile());

    select(path: string): void {
        this.selected.set(path);
    }

    openFile(path: string): void {
        this.editorGroups.openFile(path);
    }

    // Module files rewrite requires in dependents (same engine as the Rename
    // dialog); other files/folders just move on disk. Either way open tabs
    // follow the new path. Returns the new absolute path, or null on failure.
    async renameNode(node: FileNode, newName: string): Promise<string | null> {
        const root = this.project.root();
        if (!root) return null;
        try {
            let newAbs: string;
            if (!node.isDir && /\.luau?$/i.test(node.path)) {
                const plan = await buildRenamePlanForFile(root, node.path, newName);
                newAbs = plan ? await applyRenamePlan(root, plan) : await renameEntry(node.path, newName);
            } else {
                newAbs = await renameEntry(node.path, newName);
            }
            this.editorGroups.renameFile(node.path, newAbs);
            return newAbs;
        } catch (err) {
            await message(String(err), { title: 'Error', kind: 'error' });
            return null;
        }
    }
}
