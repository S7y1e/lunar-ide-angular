import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import {
    GitCommit,
    GitStatus,
    gitCommit,
    gitDiscard,
    gitIsRepo,
    gitLog,
    gitStage,
    gitStageAll,
    gitStatus,
    gitUnstage,
} from '../core/git';

// Angular port of use-git.ts. No filesystem watcher yet (the original
// re-refreshes on any change under the project root) — refresh happens on
// project-open and after each action, which covers the common flow.
@Injectable({ providedIn: 'root' })
export class GitService {
    private readonly project = inject(ProjectService);

    readonly isRepo = signal<boolean | null>(null);
    readonly status = signal<GitStatus | null>(null);
    readonly commits = signal<GitCommit[]>([]);
    readonly error = signal<string | null>(null);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    async refresh(): Promise<void> {
        try {
            const repo = await gitIsRepo();
            this.isRepo.set(repo);
            if (!repo) return;
            const [s, log] = await Promise.all([gitStatus(), gitLog()]);
            this.status.set(s);
            this.commits.set(log);
            this.error.set(null);
        } catch (e) {
            this.error.set(String(e));
        }
    }

    private act(fn: () => Promise<unknown>): Promise<void> {
        return fn()
            .then(() => this.refresh())
            .catch((e) => this.error.set(String(e)));
    }

    stage(path: string): Promise<void> {
        return this.act(() => gitStage(path));
    }
    unstage(path: string): Promise<void> {
        return this.act(() => gitUnstage(path));
    }
    stageAll(): Promise<void> {
        return this.act(() => gitStageAll());
    }
    discard(path: string): Promise<void> {
        return this.act(() => gitDiscard(path));
    }
    commit(message: string): Promise<void> {
        return this.act(() => gitCommit(message));
    }
}
