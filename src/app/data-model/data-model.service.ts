import { Injectable, computed } from '@angular/core';
import { createProjectResource } from '../core/project-resource';
import { DataModelNode, getProjectDataModel } from '../core/project-queries';
import { makeResolver } from '../core/resolve-instance';

const WATCHED_EXTS = ['.luau', '.lua', '.json', '.toml'];

export function isRelevant(path: string): boolean {
    // The tree is generated in memory from the sources, so sourcemap.json is not
    // an input here — reacting to it would just mean a second, identical rebuild
    // every time the language server's copy is rewritten.
    if (path.replace(/\\/g, '/').endsWith('sourcemap.json')) return false;
    return WATCHED_EXTS.some((ext) => path.endsWith(ext));
}

// Fetches the sourcemap-derived DataModel tree — used both for the DataModel
// panel itself and (via `resolve`) to turn a Studio instance path into a
// source file for the Runtime panel's clickable stack traces.
@Injectable({ providedIn: 'root' })
export class DataModelService {
    private readonly resource = createProjectResource<DataModelNode | null>(getProjectDataModel, null, {
        match: isRelevant,
        delayMs: 300,
    });

    readonly tree = this.resource.data;
    readonly loading = this.resource.loading;

    readonly resolve = computed(() => makeResolver(this.tree()));

    refresh(): void {
        this.resource.refresh();
    }
}
