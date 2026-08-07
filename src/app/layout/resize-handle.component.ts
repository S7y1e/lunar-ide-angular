import { Component, input, output } from '@angular/core';

// Draggable divider between two panels. Emits the pointer's incremental delta
// along the resize axis on every move; the consumer decides how to apply it
// (px width, % split ratio, clamped to its own min/max). Angular has no
// react-resizable-panels equivalent, so this is a small from-scratch port of
// the same pointer-capture-on-window approach used by the dock/tab drags.
@Component({
    selector: 'app-resize-handle',
    standalone: true,
    templateUrl: './resize-handle.component.html',
    styleUrl: './resize-handle.component.scss',
})
export class ResizeHandleComponent {
    // 'horizontal' = a vertical divider line, dragged left/right.
    // 'vertical' = a horizontal divider line, dragged up/down.
    readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
    readonly drag = output<number>();

    protected onPointerDown(e: PointerEvent): void {
        if (e.button !== 0) return;
        e.preventDefault();
        const axis = this.orientation() === 'horizontal' ? 'clientX' : 'clientY';
        let last = e[axis];

        const move = (ev: PointerEvent) => {
            const cur = ev[axis];
            this.drag.emit(cur - last);
            last = cur;
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }
}
