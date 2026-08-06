import { Component, inject } from '@angular/core';
import { EditorGroupsService } from '../core/editor-groups.service';
import { baseName } from '../core/path';

@Component({
    selector: 'app-editor-tabs',
    standalone: true,
    templateUrl: './editor-tabs.component.html',
    styleUrl: './editor-tabs.component.scss',
})
export class EditorTabsComponent {
    protected readonly groups = inject(EditorGroupsService);
    protected readonly baseName = baseName;

    protected close(e: MouseEvent, path: string): void {
        e.stopPropagation();
        this.groups.close(path);
    }
}
