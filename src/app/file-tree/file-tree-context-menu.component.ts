import { Component, input, output } from '@angular/core';

export type MenuItem = {
    label: string;
    onClick: () => void;
    danger?: boolean;
};

// Angular port of file-tree/context-menu.tsx.
@Component({
    selector: 'app-file-tree-context-menu',
    standalone: true,
    templateUrl: './file-tree-context-menu.component.html',
    styleUrl: './file-tree-context-menu.component.scss',
})
export class FileTreeContextMenuComponent {
    readonly x = input.required<number>();
    readonly y = input.required<number>();
    readonly items = input.required<MenuItem[]>();
    readonly closed = output<void>();

    protected run(item: MenuItem): void {
        item.onClick();
        this.closed.emit();
    }
}
