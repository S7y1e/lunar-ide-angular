import { Component, inject, input } from '@angular/core';
import { LayoutService } from '../core/layout.service';
import { Dock, regionId } from '../core/layout.types';
import { ToolWindowComponent } from './tool-window.component';
import { ACTIVITY_VIEWS } from '../activity-bar/activity-views';

// Simplified port of dock.tsx: renders the active tool for a dock. Split
// slots (a/b side-by-side) and drag-to-resize (react-resizable-panels in the
// original) aren't wired up yet — one tool per dock for this first pass.
@Component({
    selector: 'app-dock',
    standalone: true,
    imports: [ToolWindowComponent],
    templateUrl: './dock.component.html',
    styleUrl: './dock.component.scss',
})
export class DockComponent {
    readonly dock = input.required<Dock>();
    protected readonly layout = inject(LayoutService);

    protected region() {
        return regionId(this.dock(), 'a');
    }

    protected tool() {
        return this.layout.activeIn(this.region());
    }

    protected label(id: string): string {
        return ACTIVITY_VIEWS.find((v) => v.id === id)?.label ?? id;
    }
}
