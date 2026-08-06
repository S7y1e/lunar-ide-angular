import { Component, HostListener, computed, inject, output, signal } from '@angular/core';
import { GitService } from './git.service';
import { GitGraphComponent } from './git-graph.component';

@Component({
    selector: 'app-git-graph-overlay',
    standalone: true,
    imports: [GitGraphComponent],
    templateUrl: './git-graph-overlay.component.html',
    styleUrl: './git-graph-overlay.component.scss',
})
export class GitGraphOverlayComponent {
    readonly close = output<void>();

    protected readonly git = inject(GitService);
    protected readonly selected = signal<string | null>(null);

    protected readonly detail = computed(() => {
        const hash = this.selected();
        return hash ? (this.git.commits().find((c) => c.hash === hash) ?? null) : null;
    });

    @HostListener('document:keydown', ['$event'])
    protected onDocumentKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') this.close.emit();
    }
}
