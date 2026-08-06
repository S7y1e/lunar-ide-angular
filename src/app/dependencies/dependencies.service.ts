import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { DependencyGraph, getProjectDependencies } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class DependenciesService {
    private readonly project = inject(ProjectService);

    readonly graph = signal<DependencyGraph | null>(null);
    readonly loading = signal(false);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    refresh(): void {
        this.loading.set(true);
        getProjectDependencies()
            .then((g) => this.graph.set(g))
            .catch(() => this.graph.set(null))
            .finally(() => this.loading.set(false));
    }
}
