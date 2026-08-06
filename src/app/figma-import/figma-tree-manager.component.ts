import { Component, computed, input, output, signal } from '@angular/core';
import { UiNode, RobloxClass } from './figma-types';
import { toggleInSet } from '../core/set-utils';
import { FigmaTreeRowComponent, TreeRowCtx } from './figma-tree-row.component';

@Component({
    selector: 'app-figma-tree-manager',
    standalone: true,
    imports: [FigmaTreeRowComponent],
    templateUrl: './figma-tree-manager.component.html',
    styleUrl: './figma-tree-manager.component.scss',
})
export class FigmaTreeManagerComponent {
    readonly trees = input.required<UiNode[]>();
    readonly selectedIdx = input.required<number>();
    readonly selectedIds = input.required<Set<string>>();
    readonly excluded = input.required<Set<string>>();
    readonly overrides = input.required<Map<string, RobloxClass>>();

    readonly selectTree = output<number>();
    readonly selectNode = output<{ id: string; multi: boolean }>();
    readonly toggleExclude = output<string>();

    private readonly collapsed = signal<Set<string>>(new Set());

    protected readonly tree = computed(() => this.trees()[this.selectedIdx()]);

    protected readonly ctx = computed<TreeRowCtx>(() => ({
        selectedIds: this.selectedIds(),
        excluded: this.excluded(),
        overrides: this.overrides(),
        collapsed: this.collapsed(),
        onSelect: (id, multi) => this.selectNode.emit({ id, multi }),
        onToggleExclude: (id) => this.toggleExclude.emit(id),
        onToggleCollapse: (id) => this.collapsed.update((prev) => toggleInSet(prev, id)),
    }));

    protected onSelectChange(value: string): void {
        this.selectTree.emit(Number(value));
    }
}
