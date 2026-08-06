import { Component, computed, inject, input } from '@angular/core';
import { pathSegments } from '../core/path';
import { ProjectService } from '../core/project.service';

// Angular port of code-editor/breadcrumbs.tsx.
@Component({
    selector: 'app-breadcrumbs',
    standalone: true,
    templateUrl: './breadcrumbs.component.html',
    styleUrl: './breadcrumbs.component.scss',
})
export class BreadcrumbsComponent {
    readonly path = input.required<string>();

    private readonly project = inject(ProjectService);

    protected readonly segments = computed(() => {
        const root = this.project.root() ?? '';
        const rel = this.path().startsWith(root) ? this.path().slice(root.length) : this.path();
        return pathSegments(rel);
    });
}
