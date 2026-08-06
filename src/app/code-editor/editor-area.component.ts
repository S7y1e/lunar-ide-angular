import { Component, inject } from '@angular/core';
import { EditorGroupsService } from '../core/editor-groups.service';
import { MonacoEditorComponent } from './monaco-editor.component';
import { EditorTabsComponent } from './editor-tabs.component';
import { BreadcrumbsComponent } from './breadcrumbs.component';

@Component({
    selector: 'app-editor-area',
    standalone: true,
    imports: [MonacoEditorComponent, EditorTabsComponent, BreadcrumbsComponent],
    templateUrl: './editor-area.component.html',
    styleUrl: './editor-area.component.scss',
})
export class EditorAreaComponent {
    protected readonly groups = inject(EditorGroupsService);
}
