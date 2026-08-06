import { Component, input } from '@angular/core';
import { UiNode, RobloxClass } from './figma-types';

export interface TreeRowCtx {
    selectedIds: Set<string>;
    excluded: Set<string>;
    overrides: Map<string, RobloxClass>;
    collapsed: Set<string>;
    onSelect: (id: string, multi: boolean) => void;
    onToggleExclude: (id: string) => void;
    onToggleCollapse: (id: string) => void;
}

@Component({
    selector: 'app-figma-tree-row',
    standalone: true,
    imports: [FigmaTreeRowComponent],
    templateUrl: './figma-tree-row.component.html',
    styleUrl: './figma-tree-manager.component.scss',
})
export class FigmaTreeRowComponent {
    readonly n = input.required<UiNode>();
    readonly depth = input.required<number>();
    readonly ctx = input.required<TreeRowCtx>();

    protected isExcluded(): boolean {
        return this.ctx().excluded.has(this.n().id);
    }

    protected isSelected(): boolean {
        return this.ctx().selectedIds.has(this.n().id);
    }

    protected isCollapsed(): boolean {
        return this.ctx().collapsed.has(this.n().id);
    }

    protected cls(): RobloxClass {
        return this.ctx().overrides.get(this.n().id) ?? this.n().className;
    }

    protected hasChildren(): boolean {
        return this.n().children.length > 0;
    }

    protected onRowClick(e: MouseEvent): void {
        this.ctx().onSelect(this.n().id, e.shiftKey || e.metaKey || e.ctrlKey);
    }

    protected onArrowClick(e: MouseEvent): void {
        e.stopPropagation();
        if (this.hasChildren()) this.ctx().onToggleCollapse(this.n().id);
    }

    protected onEyeClick(e: MouseEvent): void {
        e.stopPropagation();
        this.ctx().onToggleExclude(this.n().id);
    }
}
