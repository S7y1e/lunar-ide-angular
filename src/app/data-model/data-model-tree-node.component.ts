import { Component, ElementRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { join } from '@tauri-apps/api/path';
import { DataModelNode } from '../core/project-queries';
import { keyOf, scriptPath } from '../core/instance-path';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { iconForClass } from './class-icons';

export type NodeContext = {
    node: DataModelNode;
    chain: string[];
    x: number;
    y: number;
};

// Angular port of data-model-tree-node.tsx.
@Component({
    selector: 'app-data-model-tree-node',
    standalone: true,
    imports: [DataModelTreeNodeComponent, MatIconModule],
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
    readonly context = output<NodeContext>();

    // Signal query, so the reveal effect re-runs once the row element exists
    // rather than silently no-opping if it happens to run first.
    private readonly rowRef = viewChild<ElementRef<HTMLElement>>('row');

    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly key = computed(() => keyOf(this.chain()));
    protected readonly isOpen = computed(() => this.expanded().has(this.key()));
    protected readonly isSelected = computed(() => this.selected() === this.key());
    protected readonly hasChildren = computed(() => this.node().children.length > 0);
    protected readonly source = computed(() => scriptPath(this.node()));
    protected readonly showClass = computed(() => this.node().className !== this.node().name);
    protected readonly icon = computed(() => iconForClass(this.node().className));

    constructor() {
        // Reveal the row the panel auto-selected from the active editor file —
        // it is usually several levels deep and off-screen otherwise.
        effect(() => {
            if (this.isSelected()) this.rowRef()?.nativeElement.scrollIntoView({ block: 'nearest' });
        });
    }

    protected childChain(childName: string): string[] {
        return [...this.chain(), childName];
    }

    protected onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.select.emit(this.key());
        this.context.emit({ node: this.node(), chain: this.chain(), x: e.clientX, y: e.clientY });
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
