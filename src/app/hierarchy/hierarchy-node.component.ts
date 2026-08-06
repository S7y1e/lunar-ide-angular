import { Component, computed, effect, input, output, signal } from '@angular/core';
import { baseName } from '../core/path';

@Component({
    selector: 'app-hierarchy-node',
    standalone: true,
    imports: [HierarchyNodeComponent],
    templateUrl: './hierarchy-node.component.html',
    styleUrl: './hierarchy-node.component.scss',
})
export class HierarchyNodeComponent {
    readonly node = input.required<string>();
    readonly childrenOf = input.required<(node: string) => string[]>();
    readonly ancestors = input.required<Set<string>>();
    readonly depth = input.required<number>();
    readonly openNode = output<string>();

    protected readonly baseName = baseName;
    protected readonly open = signal(false);

    protected readonly isCycle = computed(() => this.ancestors().has(this.node()));
    protected readonly children = computed(() => (this.isCycle() ? [] : this.childrenOf()(this.node())));
    protected readonly childAncestors = computed(() => new Set([...this.ancestors(), this.node()]));

    private initialized = false;

    constructor() {
        // depth === 0 starts expanded; run once when the depth input first
        // resolves (guarded so later depth changes on a reused instance,
        // which shouldn't happen, wouldn't fight the user's toggle).
        effect(() => {
            const depth = this.depth();
            if (this.initialized) return;
            this.initialized = true;
            this.open.set(depth === 0);
        });
    }

    protected toggle(): void {
        this.open.set(!this.open());
    }

    protected onOpen(): void {
        this.openNode.emit(this.node());
    }
}
