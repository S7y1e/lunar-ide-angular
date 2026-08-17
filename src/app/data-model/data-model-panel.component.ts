import { Component, effect, inject, signal, untracked } from '@angular/core';
import { join } from '@tauri-apps/api/path';
import { DataModelService } from './data-model.service';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { toRelative } from '../core/path';
import {
    defaultExpanded,
    findInstanceChain,
    instancePath,
    keyOf,
    requireSnippet,
    scriptPath,
} from '../core/instance-path';
import { DataModelTreeNodeComponent, NodeContext } from './data-model-tree-node.component';
import { FileTreeContextMenuComponent, MenuItem } from '../file-tree/file-tree-context-menu.component';

const copy = (text: string): void => {
    navigator.clipboard
        ?.writeText(text)
        .catch((e) => console.warn('[datamodel] clipboard write failed', e));
};

// Angular port of data-model-panel.tsx.
@Component({
    selector: 'app-data-model-panel',
    standalone: true,
    imports: [DataModelTreeNodeComponent, FileTreeContextMenuComponent],
    templateUrl: './data-model-panel.component.html',
    styleUrl: './data-model-panel.component.scss',
})
export class DataModelPanelComponent {
    protected readonly dataModel = inject(DataModelService);
    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly expanded = signal<Set<string>>(new Set());
    protected readonly selected = signal<string | null>(null);
    protected readonly menu = signal<NodeContext | null>(null);
    private seeded = false;

    constructor() {
        // A new project gets its own seeding pass — otherwise the second project
        // opened in a session keeps the first one's expansion and selection.
        effect(() => {
            this.project.root();
            untracked(() => {
                this.seeded = false;
                this.selected.set(null);
            });
        });

        // Seed the default (2-level) expansion once per tree load.
        effect(() => {
            const tree = this.dataModel.tree();
            if (tree && !this.seeded) {
                this.seeded = true;
                this.expanded.set(defaultExpanded(tree));
            }
        });

        // Auto-reveal the active editor file: expand its ancestor chain and select it.
        effect(() => {
            const tree = this.dataModel.tree();
            const root = this.project.root();
            const active = this.editorGroups.activeFile();
            if (!tree || !root || !active) return;
            const chain = findInstanceChain(tree, toRelative(root, active));
            if (!chain) return;
            const keys = Array.from({ length: chain.length }, (_, i) => keyOf(chain.slice(0, i + 1)));
            this.expanded.update((prev) => {
                const next = new Set(prev);
                for (const k of keys) next.add(k);
                return next;
            });
            this.selected.set(keyOf(chain));
        });
    }

    protected toggle(key: string): void {
        this.expanded.update((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    protected collapseAll(): void {
        this.expanded.set(new Set());
    }

    protected menuItems(ctx: NodeContext): MenuItem[] {
        // "game.Foo.Bar" only makes sense when the tree really is rooted at the
        // DataModel; a partial sourcemap gets its own root name instead.
        const rootIsGame = this.dataModel.tree()?.className === 'DataModel';
        const items: MenuItem[] = [];
        const source = scriptPath(ctx.node);
        const root = this.project.root();

        if (source && root) {
            items.push({
                label: 'Open File',
                onClick: async () => {
                    this.editorGroups.openFile(await join(root, ...source.split('/')));
                },
            });
        }
        items.push({
            label: 'Copy Instance Path',
            onClick: () => copy(instancePath(ctx.chain, rootIsGame)),
        });
        if (ctx.node.className === 'ModuleScript') {
            items.push({
                label: 'Copy require()',
                onClick: () => copy(requireSnippet(ctx.chain, rootIsGame)),
            });
        }
        return items;
    }
}
