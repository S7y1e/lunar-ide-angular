import { Injectable } from '@angular/core';
import { createProjectResource } from '../core/project-resource';
import { TodoItem, projectTodos } from '../core/project-queries';

// Angular port of todo-panel.tsx's scan logic. No filesystem watcher yet (the
// original re-scans on any .luau/.lua change) — refresh on project-open covers
// the common case; a manual refresh button fills the gap until watch is wired up.
@Injectable({ providedIn: 'root' })
export class TodoService {
    private readonly resource = createProjectResource<TodoItem[]>(projectTodos, []);

    readonly items = this.resource.data;
    readonly loading = this.resource.loading;

    refresh(): void {
        this.resource.refresh();
    }
}
