import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { EditorGroupsService } from '../core/editor-groups.service';
import { baseName } from '../core/path';

// Movement (px) required before a press is treated as a drag instead of a click.
const DRAG_THRESHOLD = 4;

// Angular port of editor-tabs.tsx + use-tab-reorder.ts (merged, this
// codebase's convention for folding a React hook into its owning component).
@Component({
    selector: 'app-editor-tabs',
    standalone: true,
    templateUrl: './editor-tabs.component.html',
    styleUrl: './editor-tabs.component.scss',
})
export class EditorTabsComponent {
    protected readonly groups = inject(EditorGroupsService);
    protected readonly baseName = baseName;

    protected readonly draggingPath = signal<string | null>(null);

    @ViewChild('container') private container?: ElementRef<HTMLDivElement>;

    private dragIndex: number | null = null;
    private pressedPath: string | null = null;
    private pointerId: number | null = null;
    private moved = false;
    private startX = 0;

    private targetIndexAt(clientX: number): number {
        const tabs = Array.from(this.container?.nativeElement.querySelectorAll<HTMLElement>('[data-tab]') ?? []);
        for (let i = 0; i < tabs.length; i++) {
            const rect = tabs[i].getBoundingClientRect();
            if (clientX < rect.left + rect.width / 2) return i;
        }
        return tabs.length - 1;
    }

    protected startDrag(e: PointerEvent, index: number): void {
        if (e.button !== 0) return;
        this.dragIndex = index;
        this.pressedPath = this.groups.files()[index];
        this.pointerId = e.pointerId;
        this.moved = false;
        this.startX = e.clientX;
        this.draggingPath.set(this.pressedPath);
        this.container?.nativeElement.setPointerCapture(e.pointerId);
    }

    protected onPointerMove(e: PointerEvent): void {
        if (this.dragIndex === null) return;
        if (!this.moved && Math.abs(e.clientX - this.startX) < DRAG_THRESHOLD) return;
        this.moved = true;
        const target = this.targetIndexAt(e.clientX);
        if (target !== this.dragIndex) {
            this.groups.reorder(this.dragIndex, target);
            this.dragIndex = target;
        }
    }

    protected endDrag(): void {
        if (this.dragIndex === null) return;
        // A press without enough movement is a click: select the pressed tab.
        if (!this.moved && this.pressedPath) {
            this.groups.select(this.pressedPath);
        }
        if (this.pointerId !== null) {
            this.container?.nativeElement.releasePointerCapture(this.pointerId);
        }
        this.dragIndex = null;
        this.pressedPath = null;
        this.pointerId = null;
        this.draggingPath.set(null);
    }

    protected onWheel(e: WheelEvent): void {
        if (e.deltaY !== 0 && this.container) this.container.nativeElement.scrollLeft += e.deltaY;
    }

    protected close(e: PointerEvent | MouseEvent, path: string): void {
        e.stopPropagation();
        this.groups.close(path);
    }
}
