import { ToolId } from '../core/layout.types';

export type ActivityView = { id: ToolId; label: string; glyph: string };

// `glyph` is a placeholder for a real icon set (react-icons' VSC/Codicon set in
// the original app) — swap for an <ng-icon>/SVG sprite once the shell is settled.
export const ACTIVITY_VIEWS: ActivityView[] = [
    { id: 'project', label: 'Project', glyph: '📁' },
    { id: 'search', label: 'Search', glyph: '🔍' },
    { id: 'git', label: 'Git', glyph: '🌿' },
    { id: 'todo', label: 'TODO', glyph: '✅' },
    { id: 'structure', label: 'Structure', glyph: '🏛' },
    { id: 'datamodel', label: 'DataModel', glyph: '🗂' },
    { id: 'deps', label: 'Dependencies', glyph: '🔗' },
    { id: 'packages', label: 'Packages', glyph: '📦' },
    { id: 'insights', label: 'Insights', glyph: '💡' },
    { id: 'problems', label: 'Problems', glyph: '⚠' },
    { id: 'tests', label: 'Tests', glyph: '🧪' },
    { id: 'hierarchy', label: 'Hierarchy', glyph: '🌳' },
    { id: 'callhierarchy', label: 'Call Hierarchy', glyph: '📞' },
    { id: 'usages', label: 'Usages', glyph: '📋' },
    { id: 'events', label: 'Events', glyph: '📡' },
    { id: 'sync', label: 'Sync', glyph: '🔄' },
    { id: 'runtime', label: 'Runtime', glyph: '📈' },
    { id: 'profiler', label: 'Profiler', glyph: '📊' },
    { id: 'state', label: 'State', glyph: '🗄' },
    { id: 'watches', label: 'Watches', glyph: '👁' },
    { id: 'logpoints', label: 'Logpoints', glyph: '🐞' },
    { id: 'toolchain', label: 'Toolchain', glyph: '🔧' },
    { id: 'terminal', label: 'Terminal', glyph: '⌨' },
];

export const ALL_TOOLS: ToolId[] = ACTIVITY_VIEWS.map((v) => v.id);
export const DEFAULT_ACTIVITY_VIEW: ToolId = 'project';
