import { Component, computed, effect, input, output, signal } from '@angular/core';
import { findCalls, type CallNode, type Direction } from './call-hierarchy';

type Site = { file: string; line: number; column: number };

@Component({
    selector: 'app-call-hierarchy-node',
    standalone: true,
    imports: [CallHierarchyNodeComponent],
    templateUrl: './call-hierarchy-node.component.html',
    styleUrl: './call-hierarchy-node.component.scss',
})
export class CallHierarchyNodeComponent {
    readonly name = input.required<string>();
    readonly direction = input.required<Direction>();
    readonly site = input<Site | undefined>(undefined);
    readonly ancestors = input.required<Set<string>>();
    readonly depth = input.required<number>();
    readonly openAt = output<Site>();

    protected readonly open = signal(false);
    protected readonly children = signal<CallNode[] | null>(null);
    protected readonly loading = signal(false);

    protected readonly isCycle = computed(() => this.ancestors().has(this.name()));
    protected readonly childAncestors = computed(() => new Set([...this.ancestors(), this.name()]));
    protected readonly emptyLabel = computed(() => (this.direction() === 'callers' ? 'No callers' : 'No calls'));

    private initialized = false;

    constructor() {
        effect(() => {
            const depth = this.depth();
            if (this.initialized) return;
            this.initialized = true;
            this.open.set(depth === 0);
        });

        effect(() => {
            const open = this.open();
            const isCycle = this.isCycle();
            if (!open || this.children() !== null || isCycle) return;
            this.loading.set(true);
            findCalls(this.direction(), this.name())
                .then((c) => this.children.set(c))
                .catch(() => this.children.set([]))
                .finally(() => this.loading.set(false));
        });
    }

    protected toggle(): void {
        this.open.set(!this.open());
    }

    protected onLabelClick(): void {
        const site = this.site();
        if (site) this.openAt.emit(site);
    }

    protected childSite(c: CallNode): Site {
        return { file: c.file, line: c.line, column: c.column };
    }
}
