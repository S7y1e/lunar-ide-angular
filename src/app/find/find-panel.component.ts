import { Component, computed, inject, signal } from '@angular/core';
import { FindService } from './find.service';
import { SearchMatch } from '../core/project-queries';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';
import { baseName } from '../core/path';

@Component({
    selector: 'app-find-panel',
    standalone: true,
    templateUrl: './find-panel.component.html',
    styleUrl: './find-panel.component.scss',
})
export class FindPanelComponent {
    protected readonly find = inject(FindService);
    private readonly navigation = inject(EditorNavigationService);
    protected readonly baseName = baseName;
    protected readonly replace = signal('');
    protected readonly replacing = signal(false);

    protected readonly groups = computed(() => {
        const map = new Map<string, SearchMatch[]>();
        for (const match of this.find.results()?.matches ?? []) {
            const list = map.get(match.file) ?? [];
            list.push(match);
            map.set(match.file, list);
        }
        return [...map.entries()].map(([file, matches]) => ({ file, matches }));
    });

    protected readonly total = computed(() => this.find.results()?.matches.length ?? 0);

    protected async runReplace(): Promise<void> {
        if (this.replacing()) return;
        this.replacing.set(true);
        try {
            await this.find.replaceAll(this.replace());
        } finally {
            this.replacing.set(false);
        }
    }

    protected open(match: SearchMatch): void {
        this.navigation.openFileAt(match.file, match.line, match.column);
    }
}
