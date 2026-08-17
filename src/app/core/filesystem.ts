import {
    readDir,
    readTextFile,
    writeTextFile,
    mkdir,
    remove,
    rename,
    watch,
    type UnwatchFn,
    type WatchEvent,
} from '@tauri-apps/plugin-fs';
import { join, dirname } from '@tauri-apps/api/path';
import { FileNode } from '../file-tree/file-node';

// Port of lib/filesystem.ts's readDirectory — directories sort first, then
// alphabetically.
export async function readDirectory(parentPath: string): Promise<FileNode[]> {
    const entries = await readDir(parentPath);

    const nodes: FileNode[] = [];
    for (const entry of entries) {
        const path = await join(parentPath, entry.name);
        nodes.push({ name: entry.name, path, isDir: entry.isDirectory });
    }

    nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return nodes;
}

export const readFileText = (path: string): Promise<string> => readTextFile(path);
export const writeFileText = (path: string, content: string): Promise<void> =>
    writeTextFile(path, content);

const RETRIES = 5;
const retryDelay = (attempt: number): Promise<void> =>
    new Promise((r) => setTimeout(r, 80 * (attempt + 1)));

// While a sync tool (Argon in client mode) is also writing the file, our write
// can hit a transient Windows sharing violation. Retry a few times so the save
// lands in a window where the file isn't locked, instead of failing silently.
export async function writeFileTextRetry(path: string, content: string): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
            await writeTextFile(path, content);
            return;
        } catch (e) {
            lastErr = e;
            await retryDelay(attempt);
        }
    }
    throw lastErr;
}

// Reads can also fail with a sharing violation while the sync tool holds the
// file. Retry instead of falling back to empty content — treating a failed
// read as "" is what lets the editor later overwrite the real file with
// nothing.
export async function readFileTextRetry(path: string): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
            return await readTextFile(path);
        } catch (e) {
            lastErr = e;
            await retryDelay(attempt);
        }
    }
    throw lastErr;
}

export type WatchHandle = { dispose: () => void };

// Registering an fs watcher is async, which leaves a window where the caller
// already wants it gone — a closed tab, a switched project, a destroyed
// component. Callers that just hold a handle and dispose it get that window
// handled here instead of each re-deriving the same race (and leaking a live
// watcher when they get it wrong).
export function startWatch(
    path: string,
    onEvent: (event: WatchEvent) => void,
    options: { recursive?: boolean; delayMs: number },
    label = 'watch',
): WatchHandle {
    let disposed = false;
    let unwatch: UnwatchFn | undefined;

    watch(path, (event) => { if (!disposed) onEvent(event); }, options)
        .then((fn) => {
            if (disposed) fn();
            else unwatch = fn;
        })
        .catch((e) => console.warn(`[${label}] watch failed`, path, e));

    return {
        dispose(): void {
            disposed = true;
            unwatch?.();
            unwatch = undefined;
        },
    };
}

export async function createFile(parentPath: string, name: string): Promise<string> {
    const path = await join(parentPath, name);
    await writeTextFile(path, '');
    return path;
}

export async function createFolder(parentPath: string, name: string): Promise<string> {
    const path = await join(parentPath, name);
    await mkdir(path);
    return path;
}

export async function deleteEntry(path: string, isDir: boolean): Promise<void> {
    await remove(path, { recursive: isDir });
}

export async function renameEntry(oldPath: string, newName: string): Promise<string> {
    const parent = await dirname(oldPath);
    const newPath = await join(parent, newName);
    await rename(oldPath, newPath);
    return newPath;
}

// Watch a single directory (non-recursive) and fire onChange when its entries
// are added, removed, or renamed. Debounced so a burst of writes (e.g. Argon)
// triggers a single reload. Returns the unwatch function.
export const watchDirectory = (path: string, onChange: () => void): Promise<UnwatchFn> =>
    watch(path, onChange, { delayMs: 200 });

export type ProjectFile = { name: string; path: string; relativePath: string };

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'target', 'build', '.idea']);

// Port of lib/filesystem.ts's walkProjectFiles — a flat client-side file list
// for the command palette's file search (no server-side indexing needed).
export async function walkProjectFiles(root: string, max = 5000): Promise<ProjectFile[]> {
    const sep = root.includes('\\') ? '\\' : '/';
    const out: ProjectFile[] = [];
    const stack = [root];

    while (stack.length > 0 && out.length < max) {
        const dir = stack.pop()!;
        let entries;
        try {
            entries = await readDir(dir);
        } catch {
            continue;
        }
        for (const entry of entries) {
            const full = `${dir}${sep}${entry.name}`;
            if (entry.isDirectory) {
                if (!IGNORED_DIRS.has(entry.name)) stack.push(full);
            } else {
                const relativePath = full.slice(root.length).replace(/^[\\/]+/, '');
                out.push({ name: entry.name, path: full, relativePath });
            }
        }
    }
    return out;
}
