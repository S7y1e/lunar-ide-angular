export type Dock = 'left' | 'right' | 'bottom';
export type Slot = 'a' | 'b';
export type RegionId = `${Dock}.${Slot}`;
export type Placement = { dock: Dock; slot: Slot };

export type ToolId =
    | 'project'
    | 'search'
    | 'git'
    | 'todo'
    | 'structure'
    | 'datamodel'
    | 'deps'
    | 'packages'
    | 'insights'
    | 'problems'
    | 'tests'
    | 'hierarchy'
    | 'callhierarchy'
    | 'usages'
    | 'events'
    | 'sync'
    | 'runtime'
    | 'profiler'
    | 'state'
    | 'watches'
    | 'logpoints'
    | 'toolchain'
    | 'terminal';

export type LayoutState = {
    placement: Record<ToolId, Placement>;
    // Visible tool per region; absent = region collapsed.
    active: Partial<Record<RegionId, ToolId>>;
};

export const DOCKS: Dock[] = ['left', 'right', 'bottom'];
export const SLOTS: Slot[] = ['a', 'b'];

export const regionId = (dock: Dock, slot: Slot): RegionId => `${dock}.${slot}`;

const BOTTOM_TOOLS: ToolId[] = ['runtime', 'terminal', 'problems', 'tests'];
const RIGHT_TOOLS: ToolId[] = ['state'];

function defaultDock(id: ToolId): Placement {
    if (BOTTOM_TOOLS.includes(id)) return { dock: 'bottom', slot: 'a' };
    if (RIGHT_TOOLS.includes(id)) return { dock: 'right', slot: 'a' };
    return { dock: 'left', slot: 'a' };
}

export function defaultLayout(allTools: ToolId[]): LayoutState {
    const placement = Object.fromEntries(
        allTools.map((id) => [id, defaultDock(id)]),
    ) as Record<ToolId, Placement>;
    return { placement, active: { 'left.a': 'project' } };
}

// Fill in any tool missing from a saved layout (e.g. a newly added tool window).
export function withDefaults(allTools: ToolId[], saved: Partial<LayoutState>): LayoutState {
    const defaults = defaultLayout(allTools);
    const placement = { ...defaults.placement, ...(saved.placement ?? {}) };
    return { placement, active: saved.active ?? { ...defaults.active } };
}
