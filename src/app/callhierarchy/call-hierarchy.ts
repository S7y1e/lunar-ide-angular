import { callersOf, calleesOf } from '../core/project-queries';

export type Direction = 'callers' | 'callees';

// One node shape for both directions: a related function + the call-site to
// reveal. callers → who calls X (site = the call, in the caller's file);
// callees → what X calls (site = the call, in X's file).
export type CallNode = {
    name: string;
    file: string;
    line: number;
    column: number;
};

// The Rust call graph resolves cross-module calls the LSP can't (e.g.
// PlayerManager.AddPlayer used in another file via require).
export function findCalls(direction: Direction, name: string): Promise<CallNode[]> {
    return direction === 'callers'
        ? callersOf(name).then((cs) => cs.map((c) => ({ name: c.caller, file: c.file, line: c.line, column: c.column })))
        : calleesOf(name).then((cs) => cs.map((c) => ({ name: c.callee, file: c.file, line: c.line, column: c.column })));
}
