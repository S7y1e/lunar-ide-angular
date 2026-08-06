import { Injectable, computed, signal } from '@angular/core';
import { ALL_TOOLS } from '../activity-bar/activity-views';
import {
    Dock,
    RegionId,
    Slot,
    ToolId,
    defaultLayout,
    regionId,
} from './layout.types';

// Signal-based port of use-layout.ts. Settings persistence (readSettings/
// writeSettings in the original) isn't wired up yet — this only holds layout
// in memory for now.
@Injectable({ providedIn: 'root' })
export class LayoutService {
    private readonly state = signal(defaultLayout(ALL_TOOLS));

    readonly placement = computed(() => this.state().placement);
    readonly active = computed(() => this.state().active);

    region(tool: ToolId): RegionId {
        const p = this.state().placement[tool];
        return regionId(p.dock, p.slot);
    }

    activeIn(region: RegionId): ToolId | undefined {
        return this.state().active[region];
    }

    isOpen(tool: ToolId): boolean {
        return this.activeIn(this.region(tool)) === tool;
    }

    toolsInDock(dock: Dock): ToolId[] {
        return ALL_TOOLS.filter((t) => this.state().placement[t].dock === dock);
    }

    // Slots of a dock that have a visible tool actually placed there.
    openSlots(dock: Dock): Slot[] {
        const s = this.state();
        return (['a', 'b'] as Slot[]).filter((slot) => {
            const t = s.active[regionId(dock, slot)];
            return !!t && s.placement[t].dock === dock && s.placement[t].slot === slot;
        });
    }

    open(tool: ToolId): void {
        this.state.update((s) => {
            const r = regionId(s.placement[tool].dock, s.placement[tool].slot);
            return { ...s, active: { ...s.active, [r]: tool } };
        });
    }

    toggle(tool: ToolId): void {
        this.state.update((s) => {
            const r = regionId(s.placement[tool].dock, s.placement[tool].slot);
            const active = { ...s.active };
            if (active[r] === tool) delete active[r];
            else active[r] = tool;
            return { ...s, active };
        });
    }

    collapse(region: RegionId): void {
        this.state.update((s) => {
            const active = { ...s.active };
            delete active[region];
            return { ...s, active };
        });
    }

    // Move a tool to (dock, slot): clear it from its old region if it was the
    // active one there, then make it active in the target region.
    place(tool: ToolId, dock: Dock, slot: Slot): void {
        this.state.update((s) => {
            const oldR = regionId(s.placement[tool].dock, s.placement[tool].slot);
            const newR = regionId(dock, slot);
            const active = { ...s.active };
            if (active[oldR] === tool) delete active[oldR];
            active[newR] = tool;
            return { ...s, placement: { ...s.placement, [tool]: { dock, slot } }, active };
        });
    }
}
