import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import * as monaco from 'monaco-editor';
import { readFileText, writeFileText } from './filesystem';
import { ProjectService } from './project.service';
import { pathToUri } from './monaco-uri';
import { readSession, writeSession } from './session-store';

const SESSION_SAVE_DELAY_MS = 400;

// Dispose the Monaco model backing `path`, if one was ever created (a file
// that was opened at least once) — this is what tells the luau-lsp client
// (which tracks documents via monaco.editor.onWillDispose) the file closed.
function disposeModelFor(path: string): void {
    monaco.editor.getModel(monaco.Uri.parse(pathToUri(path)))?.dispose();
}

function remapMap(m: Map<string, string>, remap: (p: string) => string): Map<string, string> {
    const next = new Map<string, string>();
    for (const [path, value] of m) next.set(remap(path), value);
    return next;
}

// Angular port of use-editor-groups.ts + use-file-content.ts, scoped down: one
// group (no split-editor yet — see gap #3 in the port status notes), no
// external-change detection. Each open file keeps its own in-memory buffer so
// switching tabs doesn't discard unsaved edits — the original bug this
// version avoids by keying content per path instead of holding a single
// "current content" slot.
@Injectable({ providedIn: 'root' })
export class EditorGroupsService {
    private readonly project = inject(ProjectService);

    readonly files = signal<string[]>([]);
    readonly activeFile = signal<string | null>(null);
    readonly loading = signal(false);

    private readonly buffers = signal<Map<string, string>>(new Map());
    private readonly savedContent = signal<Map<string, string>>(new Map());

    // Session restore/persist is per project; this guards the first (restore)
    // pass after a project opens so it isn't immediately overwritten by the
    // persist effect before the restored session has loaded.
    private restored = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    readonly content = computed(() => {
        const path = this.activeFile();
        return path ? (this.buffers().get(path) ?? '') : '';
    });

    readonly dirtyFiles = computed(() => {
        const saved = this.savedContent();
        const dirty = new Set<string>();
        for (const [path, text] of this.buffers()) {
            if (text !== (saved.get(path) ?? '')) dirty.add(path);
        }
        return dirty;
    });

    constructor() {
        // Reset to a clean slate on every project switch (open, close, or
        // change), then restore that project's last session — dropping any
        // file that no longer exists on disk (e.g. deleted while the app was
        // closed) so a stale path never opens into a dead tab.
        effect(() => {
            const root = this.project.root();
            this.restored = false;
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                this.saveTimer = null;
            }
            this.files.set([]);
            this.activeFile.set(null);
            this.buffers.set(new Map());
            this.savedContent.set(new Map());
            if (!root) {
                this.restored = true;
                return;
            }
            readSession(root).then(async (session) => {
                if (this.project.root() !== root || !session) {
                    this.restored = true;
                    return;
                }
                const checks = await Promise.all(session.files.map((f) => exists(f).catch(() => false)));
                const files = session.files.filter((_, i) => checks[i]);
                if (this.project.root() !== root) return;
                if (files.length > 0) {
                    this.files.set(files);
                    const active = files.includes(session.active ?? '') ? session.active : files[0];
                    if (active) this.select(active);
                }
                this.restored = true;
            });
        });

        // Persist on every change, debounced so rapid tab open/close doesn't
        // spam disk writes. Skipped until restore has run, so it can't
        // clobber a not-yet-loaded session with the transient empty starting
        // state.
        effect(() => {
            const files = this.files();
            const active = this.activeFile();
            const root = this.project.root();
            if (!this.restored || !root) return;
            if (this.saveTimer) clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => {
                writeSession(root, { files, active });
            }, SESSION_SAVE_DELAY_MS);
        });
    }

    openFile(path: string): void {
        if (!this.files().includes(path)) {
            this.files.update((f) => [...f, path]);
        }
        this.select(path);
    }

    // Other panels (git, todo, search…) report paths relative to the project
    // root — resolve to an absolute path before opening, same as the React
    // app's openFileAt in use-editor-navigation.ts.
    async openFileAt(relPath: string): Promise<void> {
        const root = this.project.root();
        if (!root) return;
        const abs = await join(root, ...relPath.split(/[\\/]/));
        this.openFile(abs);
    }

    select(path: string): void {
        this.activeFile.set(path);
        if (this.buffers().has(path)) return; // already loaded — keep in-memory edits
        this.loading.set(true);
        readFileText(path)
            .then((text) => {
                this.buffers.update((m) => new Map(m).set(path, text));
                this.savedContent.update((m) => new Map(m).set(path, text));
            })
            .catch((e) => {
                this.buffers.update((m) => new Map(m).set(path, `// failed to read file: ${e}`));
            })
            .finally(() => this.loading.set(false));
    }

    setContent(text: string): void {
        const path = this.activeFile();
        if (!path) return;
        this.buffers.update((m) => new Map(m).set(path, text));
    }

    async save(path: string | null = this.activeFile()): Promise<void> {
        if (!path) return;
        const text = this.buffers().get(path);
        if (text === undefined) return;
        await writeFileText(path, text);
        this.savedContent.update((m) => new Map(m).set(path, text));
    }

    // Writes only the dirty buffers — every buffer already holds the in-memory
    // content regardless of which tab is active, so no Monaco model lookup is
    // needed to know what's dirty (models are only touched on rename/close).
    async saveAll(): Promise<void> {
        await Promise.all(
            [...this.dirtyFiles()].map((path) => this.save(path).catch((e) => console.error('failed to save', path, e))),
        );
    }

    // Follow a disk rename/move across the open tab + its buffers, keeping
    // position and active state (also remaps children when a folder moved).
    renameFile(oldPath: string, newPath: string): void {
        const remap = (p: string): string =>
            p === oldPath
                ? newPath
                : p.startsWith(oldPath + '\\') || p.startsWith(oldPath + '/')
                  ? newPath + p.slice(oldPath.length)
                  : p;

        // A renamed path's Monaco model (if it was ever opened) is stuck at
        // the old URI — drop it so the LSP sees a close, and the component
        // creates a fresh model at the new path next time it's selected.
        for (const path of this.files()) {
            if (remap(path) !== path) disposeModelFor(path);
        }

        this.files.update((files) => files.map(remap));
        this.buffers.update((m) => remapMap(m, remap));
        this.savedContent.update((m) => remapMap(m, remap));
        const active = this.activeFile();
        if (active) this.activeFile.set(remap(active));
    }

    // Close a tab; if it was active, the tab that slides into its old index
    // becomes active (falling back to the one before it, then to none).
    close(path: string): void {
        const files = this.files();
        const idx = files.indexOf(path);
        if (idx === -1) return;
        disposeModelFor(path);
        this.files.set(files.filter((p) => p !== path));
        this.buffers.update((m) => {
            const n = new Map(m);
            n.delete(path);
            return n;
        });
        this.savedContent.update((m) => {
            const n = new Map(m);
            n.delete(path);
            return n;
        });
        if (this.activeFile() !== path) return;
        const remaining = this.files();
        const next = remaining[idx] ?? remaining[idx - 1] ?? null;
        if (next) this.select(next);
        else this.activeFile.set(null);
    }
}
