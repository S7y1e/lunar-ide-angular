import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { Insights, getProjectInsights } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class InsightsService {
    private readonly project = inject(ProjectService);

    readonly insights = signal<Insights | null>(null);
    readonly loading = signal(false);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    refresh(): void {
        this.loading.set(true);
        getProjectInsights()
            .then((i) => this.insights.set(i))
            .catch(() => this.insights.set(null))
            .finally(() => this.loading.set(false));
    }
}
