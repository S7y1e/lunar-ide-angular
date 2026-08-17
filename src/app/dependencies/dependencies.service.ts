import { Injectable } from '@angular/core';
import { SOURCE_OR_SOURCEMAP, createProjectResource } from '../core/project-resource';
import { DependencyGraph, getProjectDependencies } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class DependenciesService {
    private readonly resource = createProjectResource<DependencyGraph | null>(getProjectDependencies, null, {
        match: SOURCE_OR_SOURCEMAP,
        delayMs: 400,
    });

    readonly graph = this.resource.data;
    readonly loading = this.resource.loading;

    refresh(): void {
        this.resource.refresh();
    }
}
