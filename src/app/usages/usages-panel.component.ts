import { Component, computed, inject } from '@angular/core';
import { UsagesService } from './usages.service';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';
import { Usage } from '../core/project-queries';
import { baseName } from '../core/path';

@Component({
    selector: 'app-usages-panel',
    standalone: true,
    templateUrl: './usages-panel.component.html',
    styleUrl: './usages-panel.component.scss',
})
export class UsagesPanelComponent {
    protected readonly usages = inject(UsagesService);
    private readonly navigation = inject(EditorNavigationService);
    protected readonly baseName = baseName;

    protected readonly groups = computed(() => {
        const map = new Map<string, Usage[]>();
        for (const u of this.usages.usages() ?? []) {
            const list = map.get(u.file) ?? [];
            list.push(u);
            map.set(u.file, list);
        }
        return [...map.entries()].map(([file, items]) => ({ file, items }));
    });

    protected readonly total = computed(() => this.usages.usages()?.length ?? 0);

    protected openAt(u: Usage): void {
        this.navigation.openFileAt(u.file, u.line, u.column);
    }
}
