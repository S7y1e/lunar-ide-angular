import { Component, computed, inject, signal } from '@angular/core';
import { join } from '@tauri-apps/api/path';
import { DependenciesService } from '../dependencies/dependencies.service';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { toRelative } from '../core/path';
import { HierarchyNodeComponent } from './hierarchy-node.component';

type Mode = 'requires' | 'requiredBy';

@Component({
    selector: 'app-hierarchy-panel',
    standalone: true,
    imports: [HierarchyNodeComponent],
    templateUrl: './hierarchy-panel.component.html',
    styleUrl: './hierarchy-panel.component.scss',
})
export class HierarchyPanelComponent {
    private readonly deps = inject(DependenciesService);
    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly loading = this.deps.loading;
    protected readonly mode = signal<Mode>('requires');

    protected readonly rel = computed(() => {
        const root = this.project.root();
        const active = this.editorGroups.activeFile();
        return root && active ? toRelative(root, active) : null;
    });

    protected readonly childrenOf = computed(() => {
        const edges = this.deps.graph()?.edges ?? [];
        const mode = this.mode();
        return (node: string): string[] =>
            mode === 'requires'
                ? edges.filter((e) => e.from === node).map((e) => e.to)
                : edges.filter((e) => e.to === node).map((e) => e.from);
    });

    protected readonly emptyAncestors = new Set<string>();

    protected refresh(): void {
        this.deps.refresh();
    }

    protected async open(relFile: string): Promise<void> {
        const root = this.project.root();
        if (!root) return;
        this.editorGroups.openFile(await join(root, ...relFile.split('/')));
    }
}
