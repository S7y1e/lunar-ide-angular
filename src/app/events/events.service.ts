import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { EventGraph, getProjectEvents } from '../core/project-queries';

@Injectable({ providedIn: 'root' })
export class EventsService {
    private readonly project = inject(ProjectService);

    readonly graph = signal<EventGraph | null>(null);
    readonly loading = signal(false);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    refresh(): void {
        this.loading.set(true);
        getProjectEvents()
            .then((g) => this.graph.set(g))
            .catch(() => this.graph.set(null))
            .finally(() => this.loading.set(false));
    }
}
