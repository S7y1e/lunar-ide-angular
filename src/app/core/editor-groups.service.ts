import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import * as monaco from 'monaco-editor';
import { readFileTextRetry, writeFileTextRetry } from './filesystem';
import { ProjectWatcherService } from './project-watcher.service';
import { ProjectService } from './project.service';
import { pathToUri } from './monaco-uri';
import { readSession, writeSession } from './session-store';
import { sameText, toLf } from './text';

const SESSION_SAVE_DELAY_MS = 400;
const FILE_WATCH_DELAY_MS = 150;

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

// Angular port of use-editor-groups.ts + use-file-content.ts, scoped down to
// one group (no split-editor — see gap #3 in the port status notes). Each open
// file keeps its own in-memory buffer so switching tabs doesn't discard
// unsaved edits — the original bug this version avoids by keying content per
// path instead of holding a single "current content" slot.
//
// Because state here is already per-path, external-change detection watches
// *every* open file rather than only the active one like the React hook did:
// a background tab is just as exposed to Argon rewriting it from Studio.
@Injectable({ providedIn: 'root' })
export class EditorGroupsService {
    private readonly project = inject(ProjectService);

    readonly files = signal<string[]>([]);
    readonly activeFile = signal<string | null>(null);
    readonly loading = signal(false);

    private readonly buffers = signal<Map<string, string>>(new Map());
    private readonly savedContent = signal<Map<string, string>>(new Map());

    // What we believe is currently on disk per path. Used to tell our own
    // writes apart from external ones and to avoid re-prompting.
    private readonly diskContent = signal<Map<string, string>>(new Map());
    // Pending external changes: the file changed on disk (e.g. Argon synced it
    // from Studio) and we're waiting for the user to decide. Holds the new disk
    // contents per path; absent when there's nothing to reconcile.
    private readonly externalContent = signal<Map<string, string>>(new Map());
    // Last save error per path, surfaced to the UI so failures aren't silent.
    private readonly saveErrors = signal<Map<string, string>>(new Map());

    // Files whose contents were successfully read at least once. A file that
    // never loaded must not be saved — its buffer is empty/unknown and writing
    // it would wipe the real content on disk.
    private readonly loaded = new Set<string>();
    private readonly watcher = inject(ProjectWatcherService);

    // Session restore/persist is per project; this guards the first (restore)
    // pass after a project opens so it isn't immediately overwritten by the
    // persist effect before the restored session has loaded.
    private restored = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    readonly content = computed(() => {
        const path = this.activeFile();
        return path ? (this.buffers().get(path) ?? '') : '';
    });

    // Banner state for the active file.
    readonly externalChange = computed(() => {
        const path = this.activeFile();
        return path !== null && this.externalContent().has(path);
    });

    readonly saveError = computed(() => {
        const path = this.activeFile();
        return path ? (this.saveErrors().get(path) ?? null) : null;
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
            this.diskContent.set(new Map());
            this.externalContent.set(new Map());
            this.saveErrors.set(new Map());
            this.loaded.clear();
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

        // The shared project watcher already covers every file under the root,
        // so open tabs are a filter on it rather than a watch each.
        this.watcher.subscribe(
            (path) => this.files().includes(path),
            FILE_WATCH_DELAY_MS,
            (paths) => {
                for (const path of paths) this.onDiskEvent(path);
            },
        );
    }

    private onDiskEvent(path: string): void {
        readFileTextRetry(path)
            .then((raw) => this.ingest(path, raw))
            .catch(() => {});
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
        if (this.loaded.has(path)) return; // already loaded — keep in-memory edits
        this.loading.set(true);
        readFileTextRetry(path)
            .then((raw) => this.ingest(path, raw))
            .catch((e) => {
                // Deliberately leaves the file *unloaded* so save() refuses to
                // touch it. Writing an error string into the buffer instead
                // would overwrite the real file the moment the user hits save.
                console.error('[file] read failed', path, e);
            })
            .finally(() => this.loading.set(false));
    }

    // Load a file the first time it's opened (or recover if an earlier read
    // failed). Returning to an already-loaded file keeps its in-memory buffer
    // and only reconciles disk changes that happened in the background.
    private ingest(path: string, raw: string): void {
        if (this.loaded.has(path)) {
            this.reconcile(path, raw);
            return;
        }
        this.loaded.add(path);
        const text = toLf(raw);
        this.diskContent.update((m) => new Map(m).set(path, text));
        this.buffers.update((m) => new Map(m).set(path, text));
        this.savedContent.update((m) => new Map(m).set(path, text));
    }

    // Reconcile a disk change against the buffer, VS Code style:
    //  - identical (modulo EOL) to what we already have: no-op.
    //  - no unsaved edits: reload silently (nothing to lose).
    //  - unsaved edits present: surface a prompt; never clobber the buffer.
    private reconcile(path: string, raw: string): void {
        const disk = toLf(raw);
        const knownDisk = this.diskContent().get(path) ?? '';
        if (sameText(disk, knownDisk)) return;
        this.diskContent.update((m) => new Map(m).set(path, disk));

        const buffer = this.buffers().get(path) ?? '';
        if (sameText(disk, buffer)) {
            // Our own write came back through the watcher (possibly with EOLs
            // rewritten) — adopt it as saved rather than prompting.
            this.savedContent.update((m) => new Map(m).set(path, disk));
            this.clearExternal(path);
            return;
        }

        const dirty = buffer !== (this.savedContent().get(path) ?? '');
        if (!dirty) {
            this.buffers.update((m) => new Map(m).set(path, disk));
            this.savedContent.update((m) => new Map(m).set(path, disk));
            this.clearExternal(path);
            return;
        }
        this.externalContent.update((m) => new Map(m).set(path, disk));
    }

    private clearExternal(path: string): void {
        if (!this.externalContent().has(path)) return;
        this.externalContent.update((m) => {
            const n = new Map(m);
            n.delete(path);
            return n;
        });
    }

    // Accept the disk version, replacing the buffer.
    reloadFromDisk(path: string | null = this.activeFile()): void {
        if (!path) return;
        const disk = this.externalContent().get(path);
        if (disk === undefined) return;
        this.diskContent.update((m) => new Map(m).set(path, disk));
        this.buffers.update((m) => new Map(m).set(path, disk));
        this.savedContent.update((m) => new Map(m).set(path, disk));
        this.clearExternal(path);
    }

    // Keep the editor's version. The change stays dismissed until the file
    // changes on disk again; a save will push our version back out.
    keepMine(path: string | null = this.activeFile()): void {
        if (path) this.clearExternal(path);
    }

    setContent(text: string): void {
        const path = this.activeFile();
        if (!path) return;
        this.buffers.update((m) => new Map(m).set(path, text));
    }

    async save(path: string | null = this.activeFile()): Promise<void> {
        if (!path) return;
        // Never write a file we couldn't read: its buffer is empty/unknown and
        // saving would wipe the real content on disk.
        if (!this.loaded.has(path)) {
            this.setSaveError(
                path,
                'File not loaded yet (still locked by the sync tool?) — not saving to avoid overwriting it.',
            );
            return;
        }
        const text = this.buffers().get(path);
        if (text === undefined) return;
        try {
            await writeFileTextRetry(path, text);
        } catch (e) {
            this.setSaveError(path, String(e));
            throw e;
        }
        this.diskContent.update((m) => new Map(m).set(path, text));
        this.savedContent.update((m) => new Map(m).set(path, text));
        this.setSaveError(path, null);
        // Saving makes our version authoritative, clearing any pending prompt.
        this.clearExternal(path);
    }

    private setSaveError(path: string, message: string | null): void {
        this.saveErrors.update((m) => {
            const n = new Map(m);
            if (message === null) n.delete(path);
            else n.set(path, message);
            return n;
        });
    }

    // Writes only the dirty buffers — every buffer already holds the in-memory
    // content regardless of which tab is active, so no Monaco model lookup is
    // needed to know what's dirty (models are only touched on rename/close).
    async saveAll(): Promise<void> {
        await Promise.all(
            [...this.dirtyFiles()].map((path) => this.save(path).catch((e) => console.error('failed to save', path, e))),
        );
    }

    // Forces the debounced session-persist write immediately, so a tab
    // open/close/reorder made just before the app quits isn't lost with the
    // timer still pending.
    async flushSession(): Promise<void> {
        if (!this.saveTimer) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        const root = this.project.root();
        if (!this.restored || !root) return;
        await writeSession(root, { files: this.files(), active: this.activeFile() });
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

        for (const path of [...this.loaded]) {
            const next = remap(path);
            if (next === path) continue;
            this.loaded.delete(path);
            this.loaded.add(next);
        }

        this.files.update((files) => files.map(remap));
        this.buffers.update((m) => remapMap(m, remap));
        this.savedContent.update((m) => remapMap(m, remap));
        this.diskContent.update((m) => remapMap(m, remap));
        this.externalContent.update((m) => remapMap(m, remap));
        this.saveErrors.update((m) => remapMap(m, remap));
        const active = this.activeFile();
        if (active) this.activeFile.set(remap(active));
    }

    reorder(from: number, to: number): void {
        this.files.update((files) => {
            const next = [...files];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
    }

    // Close a tab; if it was active, the tab that slides into its old index
    // becomes active (falling back to the one before it, then to none).
    close(path: string): void {
        const files = this.files();
        const idx = files.indexOf(path);
        if (idx === -1) return;
        disposeModelFor(path);
        this.files.set(files.filter((p) => p !== path));
        this.loaded.delete(path);
        const drop = (m: Map<string, string>): Map<string, string> => {
            const n = new Map(m);
            n.delete(path);
            return n;
        };
        this.buffers.update(drop);
        this.savedContent.update(drop);
        this.diskContent.update(drop);
        this.externalContent.update(drop);
        this.saveErrors.update(drop);
        if (this.activeFile() !== path) return;
        const remaining = this.files();
        const next = remaining[idx] ?? remaining[idx - 1] ?? null;
        if (next) this.select(next);
        else this.activeFile.set(null);
    }
}
