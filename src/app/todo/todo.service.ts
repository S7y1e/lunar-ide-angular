import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { TodoItem, projectTodos } from '../core/project-queries';

// Angular port of todo-panel.tsx's scan logic. No filesystem watcher yet (the
// original re-scans on any .luau/.lua change) — refresh on project-open covers
// the common case; a manual refresh button fills the gap until watch is wired up.
@Injectable({ providedIn: 'root' })
export class TodoService {
    private readonly project = inject(ProjectService);

    readonly items = signal<TodoItem[]>([]);
    readonly loading = signal(false);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    refresh(): void {
        this.loading.set(true);
        projectTodos()
            .then((items) => this.items.set(items))
            .catch(() => this.items.set([]))
            .finally(() => this.loading.set(false));
    }
}
