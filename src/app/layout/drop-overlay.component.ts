import { Component, input } from '@angular/core';
import { Dock, Slot } from '../core/layout.types';

// Angular port of drop-overlay.tsx. Shown while dragging a tool window. Three
// edge bands, each split into a main (slot a) and split (slot b) drop zone.
// DockDragService hit-tests these via [data-zone] and highlights the one
// under the pointer through `hot`.
@Component({
    selector: 'app-drop-overlay',
    standalone: true,
    templateUrl: './drop-overlay.component.html',
    styleUrl: './drop-overlay.component.scss',
})
export class DropOverlayComponent {
    readonly hot = input<string | null>(null);

    protected zoneId(dock: Dock, slot: Slot): string {
        return `${dock}.${slot}`;
    }
}
