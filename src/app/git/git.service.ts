import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { ProjectWatcherService } from '../core/project-watcher.service';
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

// Coarser than the other watchers on purpose: git status has to react to
// anything (a checkout, a commit made in a terminal, an index write), so it
// takes no path filter and coalesces harder to avoid a storm of `git status`
// runs during a branch switch.
const GIT_WATCH_DELAY_MS = 600;

// Angular port of use-git.ts.
@Injectable({ providedIn: 'root' })
export class GitService {
    private readonly project = inject(ProjectService);
    private readonly watcher = inject(ProjectWatcherService);

    readonly isRepo = signal<boolean | null>(null);
    readonly status = signal<GitStatus | null>(null);
    readonly commits = signal<GitCommit[]>([]);
    readonly error = signal<string | null>(null);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
        // No path filter: git status has to react to anything, including the
        // .git writes the shared watcher drops. Those are exactly the events a
        // commit made outside the IDE produces, so watch the worktree instead
        // and let the coarse debounce absorb a branch switch.
        this.watcher.subscribe(() => true, GIT_WATCH_DELAY_MS, () => this.refresh());
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
