import { Component, computed, inject, input, output } from '@angular/core';
import { join } from '@tauri-apps/api/path';
import { DataModelNode } from '../core/project-queries';
import { keyOf, scriptPath } from '../core/instance-path';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';

// Simplified port of data-model-tree-node.tsx — no right-click context menu
// (copy instance path / require snippet) or class icons yet.
@Component({
    selector: 'app-data-model-tree-node',
    standalone: true,
    imports: [DataModelTreeNodeComponent],
    templateUrl: './data-model-tree-node.component.html',
    styleUrl: './data-model-tree-node.component.scss',
})
export class DataModelTreeNodeComponent {
    readonly node = input.required<DataModelNode>();
    readonly chain = input.required<string[]>();
    readonly depth = input.required<number>();
    readonly expanded = input.required<Set<string>>();
    readonly selected = input<string | null>(null);
    readonly toggle = output<string>();
    readonly select = output<string>();

    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly key = computed(() => keyOf(this.chain()));
    protected readonly isOpen = computed(() => this.expanded().has(this.key()));
    protected readonly isSelected = computed(() => this.selected() === this.key());
    protected readonly hasChildren = computed(() => this.node().children.length > 0);
    protected readonly source = computed(() => scriptPath(this.node()));
    protected readonly showClass = computed(() => this.node().className !== this.node().name);

    protected childChain(childName: string): string[] {
        return [...this.chain(), childName];
    }

    protected async onRowClick(): Promise<void> {
        this.select.emit(this.key());
        const source = this.source();
        const root = this.project.root();
        if (source && root) {
            const abs = await join(root, ...source.split('/'));
            this.editorGroups.openFile(abs);
        } else if (this.hasChildren()) {
            this.toggle.emit(this.key());
        }
    }

    protected onChevronClick(e: Event): void {
        e.stopPropagation();
        this.toggle.emit(this.key());
    }
}
