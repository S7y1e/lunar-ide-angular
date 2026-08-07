import { Component, ElementRef, ViewChild, computed, inject, input, signal } from '@angular/core';
import { LayoutService } from '../core/layout.service';
import { Dock, Slot, ToolId, regionId } from '../core/layout.types';
import { ToolWindowComponent } from './tool-window.component';
import { DockDragService } from './dock-drag.service';
import { ResizeHandleComponent } from './resize-handle.component';
import { ACTIVITY_VIEWS } from '../activity-bar/activity-views';

const MIN_SPLIT = 15;
const MAX_SPLIT = 85;

// Port of dock.tsx: renders the tool(s) placed in a dock. Up to two slots
// (a/b) can be open side by side — left/right docks stack them vertically,
// bottom splits them horizontally, matching the React layout. A tool's own
// header strip is the drag handle for relocating it (see DockDragService).
@Component({
    selector: 'app-dock',
    standalone: true,
    imports: [ToolWindowComponent, ResizeHandleComponent],
    templateUrl: './dock.component.html',
    styleUrl: './dock.component.scss',
})
export class DockComponent {
    readonly dock = input.required<Dock>();
    protected readonly layout = inject(LayoutService);
    protected readonly dockDrag = inject(DockDragService);

    protected readonly slots = computed(() => this.layout.openSlots(this.dock()));
    protected readonly horizontal = computed(() => this.dock() === 'bottom');

    // Share of the container slot "a" takes when both a and b are open; b
    // fills the rest. Not persisted — matches react-resizable-panels, which
    // only holds this in memory for the session.
    protected readonly splitRatio = signal(50);

    @ViewChild('container') private container?: ElementRef<HTMLDivElement>;

    protected onSplitDrag(deltaPx: number): void {
        const el = this.container?.nativeElement;
        if (!el) return;
        const total = this.horizontal() ? el.clientWidth : el.clientHeight;
        if (!total) return;
        const deltaPct = (deltaPx / total) * 100;
        this.splitRatio.update((r) => Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, r + deltaPct)));
    }

    protected toolIn(slot: Slot): ToolId | undefined {
        return this.layout.activeIn(regionId(this.dock(), slot));
    }

    protected label(id: string): string {
        return ACTIVITY_VIEWS.find((v) => v.id === id)?.label ?? id;
    }

    // Start a move only when the press doesn't land on a header control (so
    // the close button keeps working).
    protected onHeaderPointerDown(e: PointerEvent, tool: ToolId): void {
        if ((e.target as HTMLElement).closest('button, input, textarea, a, select')) return;
        this.dockDrag.onPointerDown(tool, e);
    }

    protected close(slot: Slot): void {
        this.layout.collapse(regionId(this.dock(), slot));
    }
}
