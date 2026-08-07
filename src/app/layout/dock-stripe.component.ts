import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LayoutService } from '../core/layout.service';
import { DockDragService } from './dock-drag.service';
import { Dock, ToolId } from '../core/layout.types';
import { ACTIVITY_VIEWS } from '../activity-bar/activity-views';

// Angular port of dock-stripe.tsx: the icon rail for one dock. Only the
// tools currently placed in that dock show here — moving a tool to a
// different dock (drag or drop) moves its icon to that dock's own stripe.
// Three instances are mounted (left/right/bottom), matching layout.types.ts's
// three Dock values.
@Component({
    selector: 'app-dock-stripe',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './dock-stripe.component.html',
    styleUrl: './dock-stripe.component.scss',
})
export class DockStripeComponent {
    readonly dock = input.required<Dock>();

    protected readonly layout = inject(LayoutService);
    protected readonly dockDrag = inject(DockDragService);

    protected readonly tools = computed(() => this.layout.toolsInDock(this.dock()));
    protected readonly horizontal = computed(() => this.dock() === 'bottom');

    protected label(id: ToolId): string {
        return ACTIVITY_VIEWS.find((v) => v.id === id)?.label ?? id;
    }

    protected icon(id: ToolId): string {
        return ACTIVITY_VIEWS.find((v) => v.id === id)?.icon ?? 'help';
    }

    // A press that doesn't move is a click (toggle open/close); one that
    // drags past the threshold relocates the tool to a new dock/slot.
    protected onPointerDown(e: PointerEvent, tool: ToolId): void {
        this.dockDrag.onPointerDown(tool, e, () => this.layout.toggle(tool));
    }
}
