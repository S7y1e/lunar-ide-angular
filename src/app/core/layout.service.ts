import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ALL_TOOLS } from '../layout/activity-views';
import { SettingsService } from './settings.service';
import {
    Dock,
    LayoutState,
    RegionId,
    Slot,
    ToolId,
    defaultLayout,
    regionId,
    withDefaults,
} from './layout.types';

const SETTINGS_KEY = 'lunar.layout';
const SAVE_DELAY_MS = 300;

// Signal-based port of use-layout.ts, including settings persistence
// (readSettings/writeSettings there — SettingsService's shared settings.json
// blob here, under the same "lunar.layout" key).
@Injectable({ providedIn: 'root' })
export class LayoutService {
    private readonly settings = inject(SettingsService);
    private readonly state = signal(defaultLayout(ALL_TOOLS));

    readonly placement = computed(() => this.state().placement);
    readonly active = computed(() => this.state().active);

    private restored = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        // Apply the saved layout once, the first time settings finish loading.
        effect(() => {
            if (!this.settings.loaded() || this.restored) return;
            const saved = this.settings.values()[SETTINGS_KEY] as Partial<LayoutState> | undefined;
            if (saved?.placement) this.state.set(withDefaults(ALL_TOOLS, saved));
            this.restored = true;
        });

        // Persist after the initial load, debounced so a burst of moves writes once.
        effect(() => {
            const s = this.state();
            if (!this.restored) return;
            if (this.saveTimer) clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.settings.setValue(SETTINGS_KEY, s), SAVE_DELAY_MS);
        });
    }

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

    // Forces the debounced persist write immediately, so a layout change
    // made just before the app quits isn't lost with the timer still pending.
    flush(): void {
        if (!this.saveTimer) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        if (this.restored) this.settings.setValue(SETTINGS_KEY, this.state());
    }
}
