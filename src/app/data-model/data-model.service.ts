import { Injectable, computed } from '@angular/core';
import { createProjectResource } from '../core/project-resource';
import { DataModelNode, getProjectDataModel } from '../core/project-queries';
import { makeResolver } from '../core/resolve-instance';

// Fetches the sourcemap-derived DataModel tree — used both for the DataModel
// panel itself and (via `resolve`) to turn a Studio instance path into a
// source file for the Runtime panel's clickable stack traces.
@Injectable({ providedIn: 'root' })
export class DataModelService {
    private readonly resource = createProjectResource<DataModelNode | null>(getProjectDataModel, null);

    readonly tree = this.resource.data;
    readonly loading = this.resource.loading;

    readonly resolve = computed(() => makeResolver(this.tree()));

    refresh(): void {
        this.resource.refresh();
    }
}
