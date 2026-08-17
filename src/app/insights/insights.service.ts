import { Injectable } from '@angular/core';
import { SOURCE_OR_SOURCEMAP, createProjectResource } from '../core/project-resource';
import { Insights, getProjectInsights } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class InsightsService {
    private readonly resource = createProjectResource<Insights | null>(getProjectInsights, null, {
        match: SOURCE_OR_SOURCEMAP,
        delayMs: 500,
    });

    readonly insights = this.resource.data;
    readonly loading = this.resource.loading;

    refresh(): void {
        this.resource.refresh();
    }
}
