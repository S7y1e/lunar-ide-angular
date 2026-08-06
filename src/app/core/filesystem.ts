import { readDir, readTextFile, writeTextFile, mkdir, remove, rename, watch, type UnwatchFn } from '@tauri-apps/plugin-fs';
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
