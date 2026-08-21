import { DestroyRef, Injectable, inject } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { ProjectWatcherService } from '../../core/project-watcher.service';
import { getCurrentLspClient } from './lsp-registry';

// luau-lsp reads the DataModel out of sourcemap.json on disk, and Lunar pins
// `luau-lsp.sourcemap.autogenerate` off (config.ts) because Rojo cannot parse
// every project file Lunar opens — the Rust generator owns that file instead.
// Nothing kept it fresh, though: `project_data_model` builds the tree in memory
// for the panels and never writes, so only a module rename, a module move, or
// the "Sourcemap: Regenerate" command ever touched the file, and the server
// analysed whatever happened to be lying around from the last one. A file
// created since then has no instance path at all, so every
// `require(script.Parent.X)` inside it reports "Unknown require: unsupported
// path" and everything it returns degrades to an error type.
const DEBOUNCE_MS = 300;

// What can move an instance in the tree: source files, and the project files
// that map directories onto it. Content-only edits come through here too, but
// the write reports whether the tree actually changed, so they stop short of
// the reload.
//
// sourcemap.json cannot match either arm, which is what keeps our own write
// from feeding back through the watcher into another write.
export const affectsSourcemap = (path: string): boolean =>
    /\.(luau|lua)$/.test(path) || path.replace(/\\/g, '/').endsWith('.project.json');

@Injectable({ providedIn: 'root' })
export class SourcemapService {
    private readonly watcher = inject(ProjectWatcherService);
    private readonly destroyRef = inject(DestroyRef);
    private queue: Promise<void> = Promise.resolve();

    constructor() {
        const unsubscribe = this.watcher.subscribe(affectsSourcemap, DEBOUNCE_MS, () => {
            void this.write();
        });
        this.destroyRef.onDestroy(unsubscribe);
    }

    /**
     * Regenerate sourcemap.json and, if the tree moved, have the running server
     * reload it and re-analyse the open documents.
     *
     * Serialised rather than fired in parallel: two overlapping runs would race
     * on the same file, and the loser's "did it change" answer would depend on
     * whether the winner had landed yet.
     */
    write(): Promise<void> {
        this.queue = this.queue.then(async () => {
            const changed = await invoke<boolean>('project_write_sourcemap').catch(() => false);
            if (changed) getCurrentLspClient()?.revalidate();
        });
        return this.queue;
    }
}
