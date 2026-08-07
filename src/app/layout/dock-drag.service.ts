import { Injectable, inject, signal } from '@angular/core';
import { Dock, Slot, ToolId } from '../core/layout.types';
import { LayoutService } from '../core/layout.service';

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

    private tool: ToolId | null = null;
    private moved = false;
    private startX = 0;
    private startY = 0;
    private hotZone: string | null = null;

    onPointerDown(tool: ToolId, e: PointerEvent, onClick?: () => void): void {
        if (e.button !== 0) return;
        e.preventDefault();
        this.tool = tool;
        this.moved = false;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.hotZone = null;

        const move = (ev: PointerEvent) => {
            if (!this.moved && Math.hypot(ev.clientX - this.startX, ev.clientY - this.startY) < THRESHOLD) return;
            if (!this.moved) {
                this.moved = true;
                this.dragTool.set(this.tool);
            }
            const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
            const zone = el?.closest<HTMLElement>('[data-zone]');
            this.hotZone = zone?.dataset['zone'] ?? null;
            this.hot.set(this.hotZone);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            if (!this.moved) {
                onClick?.();
            } else if (this.hotZone && this.tool) {
                const [dock, slot] = this.hotZone.split('.') as [Dock, Slot];
                this.layout.place(this.tool, dock, slot);
            }
            this.tool = null;
            this.moved = false;
            this.hotZone = null;
            this.dragTool.set(null);
            this.hot.set(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }
}
