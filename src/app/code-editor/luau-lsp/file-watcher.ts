import { watch, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";
import { pathToUri } from "../../core/monaco-uri";

// LSP FileChangeType (textDocument/didChangeWatchedFiles).
const CREATED = 1;
const CHANGED = 2;
const DELETED = 3;

// Directories whose churn never affects luau-lsp's view of the project. Watching
// them would flood the server (and us) with irrelevant events.
const IGNORED_SEGMENTS = [
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".idea",
].flatMap((d) => [`\\${d}\\`, `/${d}/`]);

// Files that can change what luau-lsp knows: source modules, the sourcemap, and
// the project/config files that define the DataModel (so requires resolve).
function isRelevant(path: string): boolean {
    if (IGNORED_SEGMENTS.some((seg) => path.includes(seg))) return false;
    return (
        path.endsWith(".luau") ||
        path.endsWith(".lua") ||
        path.endsWith(".luaurc") ||
        path.endsWith(".json") || // sourcemap.json, *.project.json
        path.endsWith(".toml") // wally.toml
    );
}

function changeType(event: WatchEvent): number {
    const t = event.type;
    if (typeof t === "object" && t !== null) {
        if ("create" in t) return CREATED;
        if ("remove" in t) return DELETED;
    }
    return CHANGED;
}

export type FileChange = { uri: string; type: number };

// Watch the workspace recursively and report relevant changes as LSP file
// changes. Debounced by the plugin so a burst (e.g. Argon rewriting many files
// or a sourcemap regeneration) collapses into a few callbacks instead of one
// per file.
export function watchWorkspace(
    root: string,
    onChanges: (changes: FileChange[]) => void,
): Promise<UnwatchFn> {
    return watch(
        root,
        (event) => {
            const type = changeType(event);
            const changes: FileChange[] = [];
            for (const path of event.paths) {
                if (!isRelevant(path)) continue;
                changes.push({ uri: pathToUri(path), type });
            }
            if (changes.length > 0) onChanges(changes);
        },
        { recursive: true, delayMs: 250 },
    );
}
