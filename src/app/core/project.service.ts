import { Injectable, computed, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ProjectSnapshot, getProjectSnapshot } from './project-queries';

// Shared "which project is open" state — the Rust backend keeps its own copy
// of the root path (ProjectStore) for git/etc. commands, set via project_open;
// this service is the frontend's view of the same fact (plus the fuller
// ProjectSnapshot — sync backend, test command, etc.) so any panel can react
// to it without re-threading a path prop.
@Injectable({ providedIn: 'root' })
export class ProjectService {
    readonly snapshot = signal<ProjectSnapshot | null>(null);
    readonly root = computed(() => this.snapshot()?.root ?? null);

    constructor() {
        listen('project://changed', () => {
            getProjectSnapshot().then((snap) => {
                if (snap) this.snapshot.set(snap);
            });
        });
    }

    async open(root: string): Promise<void> {
        const snap = await invoke<ProjectSnapshot>('project_open', { root });
        this.snapshot.set(snap);
    }

    async close(): Promise<void> {
        await invoke('project_close');
        this.snapshot.set(null);
    }
}
