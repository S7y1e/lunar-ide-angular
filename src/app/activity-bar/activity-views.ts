import { ToolId } from '../core/layout.types';

// `icon` is a Material Symbols ligature name, rendered via <mat-icon> — the
// closest available match per tool to the Codicon (react-icons/vsc) set used
// in the original app.
export type ActivityView = { id: ToolId; label: string; icon: string };

export const ACTIVITY_VIEWS: ActivityView[] = [
    { id: 'project', label: 'Project', icon: 'folder' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'git', label: 'Git', icon: 'merge' },
    { id: 'todo', label: 'TODO', icon: 'checklist' },
    { id: 'structure', label: 'Structure', icon: 'schema' },
    { id: 'datamodel', label: 'DataModel', icon: 'account_tree' },
    { id: 'deps', label: 'Dependencies', icon: 'link' },
    { id: 'packages', label: 'Packages', icon: 'inventory_2' },
    { id: 'insights', label: 'Insights', icon: 'lightbulb' },
    { id: 'problems', label: 'Problems', icon: 'warning' },
    { id: 'tests', label: 'Tests', icon: 'science' },
    { id: 'hierarchy', label: 'Hierarchy', icon: 'hub' },
    { id: 'callhierarchy', label: 'Call Hierarchy', icon: 'call_received' },
    { id: 'usages', label: 'Usages', icon: 'format_list_bulleted' },
    { id: 'events', label: 'Events', icon: 'sensors' },
    { id: 'sync', label: 'Sync', icon: 'sync' },
    { id: 'runtime', label: 'Runtime', icon: 'monitor_heart' },
    { id: 'profiler', label: 'Profiler', icon: 'dashboard' },
    { id: 'state', label: 'State', icon: 'database' },
    { id: 'watches', label: 'Watches', icon: 'visibility' },
    { id: 'logpoints', label: 'Logpoints', icon: 'bug_report' },
    { id: 'toolchain', label: 'Toolchain', icon: 'build' },
    { id: 'terminal', label: 'Terminal', icon: 'terminal' },
];

export const ALL_TOOLS: ToolId[] = ACTIVITY_VIEWS.map((v) => v.id);
export const DEFAULT_ACTIVITY_VIEW: ToolId = 'project';
