import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { DataModelNode, getProjectDataModel } from '../core/project-queries';
import { makeResolver } from '../core/resolve-instance';

// Fetches the sourcemap-derived DataModel tree — used both for the DataModel
// panel itself and (via `resolve`) to turn a Studio instance path into a
// source file for the Runtime panel's clickable stack traces.
@Injectable({ providedIn: 'root' })
export class DataModelService {
    private readonly project = inject(ProjectService);

    readonly tree = signal<DataModelNode | null>(null);
    readonly loading = signal(false);

    readonly resolve = computed(() => makeResolver(this.tree()));

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    refresh(): void {
        this.loading.set(true);
        getProjectDataModel()
            .then((t) => this.tree.set(t))
            .catch(() => this.tree.set(null))
            .finally(() => this.loading.set(false));
    }
}
