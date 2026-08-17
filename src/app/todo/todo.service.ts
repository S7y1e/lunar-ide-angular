import { Injectable } from '@angular/core';
import { LUAU_SOURCE, createProjectResource } from '../core/project-resource';
import { TodoItem, projectTodos } from '../core/project-queries';

// Angular port of todo-panel.tsx's scan logic, re-scanning on any .luau/.lua
// change under the project root.
@Injectable({ providedIn: 'root' })
export class TodoService {
    private readonly resource = createProjectResource<TodoItem[]>(projectTodos, [], {
        match: LUAU_SOURCE,
        delayMs: 500,
    });

    readonly items = this.resource.data;
    readonly loading = this.resource.loading;

    refresh(): void {
        this.resource.refresh();
    }
}
