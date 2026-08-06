import { Component, computed, inject } from '@angular/core';
import { TodoService } from './todo.service';
import { TodoItem } from '../core/project-queries';
import { EditorGroupsService } from '../core/editor-groups.service';
import { baseName } from '../core/path';

const TAG_CLASS: Record<string, string> = {
    TODO: 'tagTodo',
    FIXME: 'tagFixme',
    HACK: 'tagHack',
    NOTE: 'tagNote',
    XXX: 'tagXxx',
};

@Component({
    selector: 'app-todo-panel',
    standalone: true,
    templateUrl: './todo-panel.component.html',
    styleUrl: './todo-panel.component.scss',
})
export class TodoPanelComponent {
    protected readonly todo = inject(TodoService);
    private readonly editorGroups = inject(EditorGroupsService);
    protected readonly baseName = baseName;

    protected readonly groups = computed(() => {
        const map = new Map<string, TodoItem[]>();
        for (const item of this.todo.items()) {
            const list = map.get(item.file) ?? [];
            list.push(item);
            map.set(item.file, list);
        }
        return [...map.entries()].map(([file, items]) => ({ file, items }));
    });

    protected tagClass(tag: string): string {
        return TAG_CLASS[tag] ?? '';
    }

    protected open(item: TodoItem): void {
        this.editorGroups.openFileAt(item.file);
    }
}
