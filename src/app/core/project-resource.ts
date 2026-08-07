import { Signal, effect, inject, signal } from '@angular/core';
import { ProjectService } from './project.service';

export type ProjectResource<T> = {
    readonly data: Signal<T>;
    readonly loading: Signal<boolean>;
    refresh(): void;
};

// Shared shape for services that fetch one piece of project-derived data
// (DataModel tree, dependency graph, event graph, insights, TODOs, packages)
// whenever a project is open: `data` (reset to `fallback` on load/error) +
// `loading`, plus a manual `refresh()` for retry/refresh-button use. Must be
// called from an injection context (a field initializer or constructor of an
// injectable class), same as `inject()`.
export function createProjectResource<T>(fetchFn: () => Promise<T>, fallback: T): ProjectResource<T> {
    const project = inject(ProjectService);
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

    return { data, loading, refresh };
}
