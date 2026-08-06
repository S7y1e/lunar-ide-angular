import { Component, effect, inject, signal } from '@angular/core';
import { StateInspectorService } from './state-inspector.service';
import { RuntimeBridgeService } from './runtime-bridge.service';
import { StateTreeNodeComponent } from './state-tree-node.component';
import { StateGuideComponent } from './state-guide.component';

@Component({
    selector: 'app-state-panel',
    standalone: true,
    imports: [StateTreeNodeComponent, StateGuideComponent],
    templateUrl: './state-panel.component.html',
    styleUrl: './state-panel.component.scss',
})
export class StatePanelComponent {
    protected readonly inspector = inject(StateInspectorService);
    protected readonly bridge = inject(RuntimeBridgeService);

    protected readonly expanded = signal<Set<string>>(new Set());
    protected readonly showGuide = signal(false);

    constructor() {
        // Auto-expand a watch root the first time it shows up.
        effect(() => {
            const names = this.inspector.watches().map((w) => w.name);
            this.expanded.update((prev) => {
                const next = new Set(prev);
                for (const n of names) next.add(n);
                return next;
            });
        });
    }

    protected toggle(path: string): void {
        this.expanded.update((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }
}
