import { Component, computed, inject } from '@angular/core';
import { DependenciesService } from './dependencies.service';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { baseName, toRelative } from '../core/path';

@Component({
    selector: 'app-dependencies-panel',
    standalone: true,
    templateUrl: './dependencies-panel.component.html',
    styleUrl: './dependencies-panel.component.scss',
})
export class DependenciesPanelComponent {
    protected readonly deps = inject(DependenciesService);
    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);
    protected readonly baseName = baseName;

    protected readonly rel = computed(() => {
        const root = this.project.root();
        const active = this.editorGroups.activeFile();
        return root && active ? toRelative(root, active) : null;
    });

    protected readonly requires = computed(() => {
        const r = this.rel();
        return r ? (this.deps.graph()?.edges.filter((e) => e.from === r) ?? []) : [];
    });

    protected readonly requiredBy = computed(() => {
        const r = this.rel();
        return r ? (this.deps.graph()?.edges.filter((e) => e.to === r) ?? []) : [];
    });

    protected readonly unresolved = computed(() => {
        const r = this.rel();
        return r ? (this.deps.graph()?.unresolved.filter((u) => u.from === r) ?? []) : [];
    });

    protected open(relFile: string): void {
        this.editorGroups.openFileAt(relFile);
    }
}
