import { Component, inject, signal } from '@angular/core';
import { CallHierarchyNodeComponent } from './call-hierarchy-node.component';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';
import type { Direction } from './call-hierarchy';

@Component({
    selector: 'app-call-hierarchy-panel',
    standalone: true,
    imports: [CallHierarchyNodeComponent],
    templateUrl: './call-hierarchy-panel.component.html',
    styleUrl: './call-hierarchy-panel.component.scss',
})
export class CallHierarchyPanelComponent {
    protected readonly navigation = inject(EditorNavigationService);
    protected readonly direction = signal<Direction>('callers');
    protected readonly emptyAncestors = new Set<string>();

    protected onOpen(site: { file: string; line: number; column: number }): void {
        this.navigation.openFileAt(site.file, site.line, site.column);
    }
}
