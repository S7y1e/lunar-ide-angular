import { Component, computed, inject, signal } from '@angular/core';
import { GitService } from './git.service';
import { isStaged, type GitFile } from '../core/git';
import { GitFileRowComponent } from './git-file-row.component';
import { GitGraphComponent } from './git-graph.component';
import { GitGraphUiService } from './git-graph-ui.service';

type Tab = 'changes' | 'graph';

// Angular port of git-panel.tsx.
@Component({
    selector: 'app-git-panel',
    standalone: true,
    imports: [GitFileRowComponent, GitGraphComponent],
    templateUrl: './git-panel.component.html',
    styleUrl: './git-panel.component.scss',
})
export class GitPanelComponent {
    protected readonly git = inject(GitService);
    protected readonly graphUi = inject(GitGraphUiService);
    protected readonly message = signal('');
    protected readonly tab = signal<Tab>('changes');
    protected readonly selected = signal<string | null>(null);

    protected readonly staged = computed<GitFile[]>(() =>
        (this.git.status()?.files ?? []).filter(isStaged),
    );
    protected readonly unstaged = computed<GitFile[]>(() =>
        (this.git.status()?.files ?? []).filter((f) => f.work !== ' '),
    );

    protected readonly detail = computed(() => {
        const hash = this.selected();
        return hash ? (this.git.commits().find((c) => c.hash === hash) ?? null) : null;
    });

    protected onCommit(): void {
        if (!this.message().trim()) return;
        this.git.commit(this.message()).then(() => this.message.set(''));
    }
}
