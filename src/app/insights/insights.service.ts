import { Injectable } from '@angular/core';
import { createProjectResource } from '../core/project-resource';
import { Insights, getProjectInsights } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class InsightsService {
    private readonly resource = createProjectResource<Insights | null>(getProjectInsights, null);

    readonly insights = this.resource.data;
    readonly loading = this.resource.loading;

    refresh(): void {
        this.resource.refresh();
    }
}
