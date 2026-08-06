import { Component, effect, inject, signal } from '@angular/core';
import { DataModelService } from './data-model.service';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { toRelative } from '../core/path';
import { defaultExpanded, findInstanceChain, keyOf } from '../core/instance-path';
import { DataModelTreeNodeComponent } from './data-model-tree-node.component';

// Simplified port of data-model-panel.tsx — no right-click context menu yet
// (copy instance path / require snippet).
@Component({
    selector: 'app-data-model-panel',
    standalone: true,
    imports: [DataModelTreeNodeComponent],
    templateUrl: './data-model-panel.component.html',
    styleUrl: './data-model-panel.component.scss',
})
export class DataModelPanelComponent {
    protected readonly dataModel = inject(DataModelService);
    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly expanded = signal<Set<string>>(new Set());
    protected readonly selected = signal<string | null>(null);
    private seeded = false;

    constructor() {
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
}
