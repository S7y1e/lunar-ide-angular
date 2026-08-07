import { Injectable, inject, signal } from '@angular/core';
import { Dock, Slot, ToolId } from '../core/layout.types';
import { LayoutService } from '../core/layout.service';
import { startPointerDrag } from './pointer-drag';

const THRESHOLD = 5; // px before a press becomes a drag instead of a click

// Angular port of use-dock-drag.ts. Pointer-based drag for tool windows — the
// Tauri webview swallows native HTML5 drag/drop (drop never fires), so this
// tracks pointer move/up on window and hit-tests the drop zones via
// elementFromPoint, same approach as the editor tab reorder.
@Injectable({ providedIn: 'root' })
export class DockDragService {
    private readonly layout = inject(LayoutService);

    readonly dragTool = signal<ToolId | null>(null);
    readonly hot = signal<string | null>(null);

    onPointerDown(tool: ToolId, e: PointerEvent, onClick?: () => void): void {
        if (e.button !== 0) return;
        e.preventDefault();
        let hotZone: string | null = null;

        const reset = (): void => {
            hotZone = null;
            this.dragTool.set(null);
            this.hot.set(null);
        };

        startPointerDrag(e, {
            threshold: THRESHOLD,
            onThresholdCrossed: () => this.dragTool.set(tool),
            onMove: (ev) => {
                const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
                const zone = el?.closest<HTMLElement>('[data-zone]');
                hotZone = zone?.dataset['zone'] ?? null;
                this.hot.set(hotZone);
            },
            onEnd: (moved) => {
                if (!moved) {
                    onClick?.();
                } else if (hotZone) {
                    const [dock, slot] = hotZone.split('.') as [Dock, Slot];
                    this.layout.place(tool, dock, slot);
                }
                reset();
            },
            onCancel: reset,
        });
    }
}
