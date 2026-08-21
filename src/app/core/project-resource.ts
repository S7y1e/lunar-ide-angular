import { DestroyRef, Signal, effect, inject, signal } from '@angular/core';
import { ProjectService } from './project.service';
import { ProjectWatcherService } from './project-watcher.service';

export type ProjectResource<T> = {
    readonly data: Signal<T>;
    readonly loading: Signal<boolean>;
    refresh(): void;
};

// Auto-refresh config: which paths under the project root should trigger a
// re-fetch, and how long to coalesce a burst of writes. The filter is per
// resource because they genuinely disagree — insights/deps/events *consume*
// sourcemap.json, while the DataModel builds its tree in memory from the
// sources and ignores the file entirely. (The file on disk is written by
// luau-lsp/sourcemap.service.ts, for the language server alone.)
export type ProjectWatch = {
    match: (path: string) => boolean;
    delayMs: number;
};

// Shared shape for services that fetch one piece of project-derived data
// (DataModel tree, dependency graph, event graph, insights, TODOs, packages)
// whenever a project is open: `data` (reset to `fallback` on load/error) +
// `loading`, plus a manual `refresh()` for retry/refresh-button use. Must be
// called from an injection context (a field initializer or constructor of an
// injectable class), same as `inject()`.
export function createProjectResource<T>(
    fetchFn: () => Promise<T>,
    fallback: T,
    watchConfig?: ProjectWatch,
): ProjectResource<T> {
    const project = inject(ProjectService);
    const watcher = inject(ProjectWatcherService);
    const destroyRef = inject(DestroyRef);
    const data = signal<T>(fallback);
    const loading = signal(false);

    function refresh(): void {
        loading.set(true);
        fetchFn()
            .then((v) => data.set(v))
            .catch(() => data.set(fallback))
            .finally(() => loading.set(false));
    }

    effect(() => {
        if (project.root()) refresh();
    });

    // The subscription outlives project switches — the shared watcher re-targets
    // itself, so there is nothing per-root to tear down here.
    if (watchConfig) {
        const unsubscribe = watcher.subscribe(watchConfig.match, watchConfig.delayMs, () => refresh());
        destroyRef.onDestroy(unsubscribe);
    }

    return { data, loading, refresh };
}

// Luau sources plus the sourcemap, which is what the Rust side reads to answer
// most project queries.
export const SOURCE_OR_SOURCEMAP = (path: string): boolean =>
    /(\.luau|\.lua|sourcemap\.json)$/.test(path);

export const LUAU_SOURCE = (path: string): boolean => /(\.luau|\.lua)$/.test(path);
