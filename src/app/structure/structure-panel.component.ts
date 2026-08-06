import { Component, inject } from '@angular/core';
import { StructureService } from './structure.service';
import { StructureNodeComponent } from './structure-node.component';
import { EditorGroupsService } from '../core/editor-groups.service';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';

@Component({
    selector: 'app-structure-panel',
    standalone: true,
    imports: [StructureNodeComponent],
    templateUrl: './structure-panel.component.html',
    styleUrl: './structure-panel.component.scss',
})
export class StructurePanelComponent {
    protected readonly structure = inject(StructureService);
    protected readonly editorGroups = inject(EditorGroupsService);
    private readonly navigation = inject(EditorNavigationService);

    protected onGoTo(e: { line: number; column: number }): void {
        this.navigation.goToLine(e.line, e.column);
    }
}
