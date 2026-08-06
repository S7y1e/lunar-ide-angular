import { Component, inject } from '@angular/core';
import { LogpointsService, Logpoint } from './logpoints.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { baseName } from '../core/path';

@Component({
    selector: 'app-logpoint-panel',
    standalone: true,
    templateUrl: './logpoint-panel.component.html',
    styleUrl: './logpoint-panel.component.scss',
})
export class LogpointPanelComponent {
    protected readonly logpoints = inject(LogpointsService);
    private readonly editorGroups = inject(EditorGroupsService);
    protected readonly baseName = baseName;

    protected open(p: Logpoint): void {
        this.editorGroups.openFileAt(p.file);
    }
}
