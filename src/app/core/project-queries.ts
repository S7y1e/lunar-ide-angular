import { invoke } from '@tauri-apps/api/core';

export type ProjectSnapshot = {
    root: string;
    name: string;
    projectFile: string;
    syncBackend: string | null;
    testCommand: string | null;
    testEz: string | null;
    testRoots: string[];
    buildOutput: string | null;
};

export const getProjectSnapshot = (): Promise<ProjectSnapshot | null> =>
    invoke('project_snapshot');

// Read-only queries against the currently open project (see ProjectService),
// ported one at a time from lib/project.tsx as each panel gets wired up.

export type TodoItem = {
    tag: string;
    file: string;
    line: number;
    column: number;
    text: string;
};

export const projectTodos = (): Promise<TodoItem[]> => invoke('project_todos');

export type SearchMatch = {
    file: string;
    line: number;
    column: number;
    text: string;
};
export type SearchResults = { matches: SearchMatch[]; truncated: boolean };

export const searchProject = (
    query: string,
    caseSensitive: boolean,
): Promise<SearchResults | null> => invoke('project_search', { query, caseSensitive });

export type ProjectSymbol = {
    name: string;
    container: string;
    file: string;
    line: number;
    column: number;
};

export const projectSymbols = (query: string): Promise<ProjectSymbol[]> =>
    invoke('project_symbols', { query });

export type DependencyEdge = { from: string; to: string };
export type UnresolvedRequire = { from: string; expr: string; line: number };
export type DependencyGraph = { edges: DependencyEdge[]; unresolved: UnresolvedRequire[] };

export const getProjectDependencies = (): Promise<DependencyGraph | null> =>
    invoke('project_dependencies');

export type Signal = {
    id: string;
    label: string;
    kind: string;
    firedBy: string[];
    connectedBy: string[];
};
export type UnresolvedEvent = { from: string; expr: string; action: string };
export type EventGraph = { signals: Signal[]; unresolved: UnresolvedEvent[] };

export const getProjectEvents = (): Promise<EventGraph | null> => invoke('project_events');

export type InsightFinding = {
    severity: string;
    category: string;
    message: string;
    file: string;
    line: number;
};
export type Insights = { findings: InsightFinding[] };

export const getProjectInsights = (): Promise<Insights | null> => invoke('project_insights');

export type Fix = { label: string; kind: 'delete-file' | 'delete-line' };

export function fixFor(category: string): Fix | null {
    if (category === 'orphan') return { label: 'Delete file', kind: 'delete-file' };
    if (category === 'unused-require') return { label: 'Remove unused require', kind: 'delete-line' };
    return null;
}

export function applyInsightFix(f: InsightFinding): Promise<void> {
    const fix = fixFor(f.category);
    if (!fix) return Promise.resolve();
    return invoke('project_fix', { kind: fix.kind, file: f.file, line: f.line });
}

export type DataModelNode = {
    name: string;
    className: string;
    filePaths: string[];
    children: DataModelNode[];
};

export const getProjectDataModel = (): Promise<DataModelNode | null> =>
    invoke('project_data_model');

export const runtimeEnqueue = (command: object): Promise<void> =>
    invoke('runtime_enqueue', { command: JSON.stringify(command) });

// Drives a play-test by focusing the Roblox Studio window and sending F5 /
// Shift+F5 — there is no Roblox API for it. Windows-only; rejects elsewhere.
export const studioPlay = (stop: boolean): Promise<void> => invoke('studio_play', { stop });

// Writes (removes) a LocalScript in the project's client container that streams
// the play-test client's output to the bridge. The Studio plugin runs in the
// server/edit VM and can't see the client's output at all.
export const clientAgentInstall = (): Promise<void> => invoke('client_agent_install');

export const clientAgentRemove = (): Promise<void> => invoke('client_agent_remove');

export type LogpointArg = { file: string; line: number; expr: string; includeStack: boolean };

export const logpointsArm = (points: LogpointArg[]): Promise<void> =>
    invoke('logpoints_arm', { points });

export const logpointsDisarm = (): Promise<void> => invoke('logpoints_disarm');

export type TestNode = {
    phrase: string;
    nodeType: string;
    status: string; // "Success" | "Failure" | "Skipped"
    errors: string[];
    children: TestNode[];
};
export type TestResults = {
    successCount?: number;
    failureCount?: number;
    skippedCount?: number;
    errors?: string[];
    children?: TestNode[];
    error?: string; // config/require/run failure, before any test ran
};
export type TestezSetup = {
    log: string;
    specFile: string | null;
    // Non-null when the project has no wally.toml: the file the backend would
    // write. Nothing was changed — confirm and call again with createWally.
    needsWally: string | null;
};

export const setupTestez = (createWally = false): Promise<TestezSetup> =>
    invoke('project_setup_testez', { createWally });

export type RenameLineEdit = { file: string; line: number; before: string; after: string };

// Precise per-line edits across dependents, resolved over the owned model in
// Rust (require chains + WaitForChild/FindFirstChild literals that actually
// name this module).
export const renameEdits = (file: string, newName: string): Promise<RenameLineEdit[]> =>
    invoke('project_rename_edits', { file, newName });

export const moveEdits = (file: string, newFile: string): Promise<RenameLineEdit[]> =>
    invoke('project_move_edits', { file, newFile });

// Sort require statements / the whole top import block (dropping unused
// requires) in `file`. Returns the new text, or null if nothing changed.
export const organizeRequires = (file: string): Promise<string | null> =>
    invoke('project_organize_requires', { file });

export const organizeImports = (file: string): Promise<string | null> =>
    invoke('project_organize_imports', { file });

export type CallerSite = { caller: string; file: string; line: number; column: number };
export type CalleeSite = { callee: string; file: string; line: number; column: number };

// The Rust call graph resolves cross-module calls the LSP can't (e.g.
// PlayerManager.AddPlayer used in another file via require).
export const callersOf = (name: string): Promise<CallerSite[]> => invoke('project_callers', { name });
export const calleesOf = (name: string): Promise<CalleeSite[]> => invoke('project_callees', { name });

export type Usage = { file: string; line: number; column: number; text: string; call: boolean };

export const memberUsages = (fromFile: string, receiver: string, member: string): Promise<Usage[]> =>
    invoke('project_member_usages', { fromFile, receiver, member });

export const projectRequirers = (file: string): Promise<string[]> => invoke('project_requirers', { file });
