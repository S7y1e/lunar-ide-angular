import { Injectable } from '@angular/core';
import { createProjectResource } from '../core/project-resource';
import { DependencyGraph, getProjectDependencies } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class DependenciesService {
    private readonly resource = createProjectResource<DependencyGraph | null>(getProjectDependencies, null);

    readonly graph = this.resource.data;
    readonly loading = this.resource.loading;

    refresh(): void {
        this.resource.refresh();
    }
}
