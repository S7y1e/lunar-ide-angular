import { Injectable, effect, inject } from '@angular/core';
import { ProjectService } from './project.service';
import { startWatch } from './filesystem';

// One recursive fs watcher for the whole app. Every panel that needs to react to
// project changes subscribes here instead of opening its own watch: on Linux each
// recursive watch costs an inotify instance plus a notify debouncer thread per
// watcher, and having seven of them over the same tree multiplied that cost while
// delivering the exact same events.
//
// Directories whose churn never affects a panel are dropped here, before fan-out,
// so a git operation or an npm install doesn't wake every subscriber. (The
// luau-lsp workspace watcher keeps its own copy of this list — it predates this
// service and talks to the language server, not to panels.)
const IGNORED = ['.git', 'node_modules', 'target', 'dist', 'build', '.idea'].flatMap((d) => [
    `/${d}/`,
    `\\${d}\\`,
]);

// The shared watcher coalesces at the finest interval any subscriber wants; each
// subscriber then applies its own debounce on top, preserving the per-panel
// intervals the individual watchers used to have.
const BASE_DELAY_MS = 150;

type Sub = {
    match: (path: string) => boolean;
    delayMs: number;
    run: (paths: string[]) => void;
    timer: ReturnType<typeof setTimeout> | null;
    pending: Set<string>;
};

@Injectable({ providedIn: 'root' })
export class ProjectWatcherService {
    private readonly project = inject(ProjectService);
    private readonly subs = new Set<Sub>();

    constructor() {
        effect((onCleanup) => {
            const root = this.project.root();
            if (!root) return;
            const handle = startWatch(
                root,
                (event) => this.fanOut(event.paths),
                { recursive: true, delayMs: BASE_DELAY_MS },
                'project',
            );
            onCleanup(() => handle.dispose());
        });
    }

    /** Returns an unsubscribe function; callers must call it on teardown. */
    subscribe(
        match: (path: string) => boolean,
        delayMs: number,
        run: (paths: string[]) => void,
    ): () => void {
        const sub: Sub = { match, delayMs, run, timer: null, pending: new Set() };
        this.subs.add(sub);
        return () => {
            if (sub.timer) clearTimeout(sub.timer);
            this.subs.delete(sub);
        };
    }

    private fanOut(paths: string[]): void {
        const relevant = paths.filter((p) => !IGNORED.some((seg) => p.includes(seg)));
        if (relevant.length === 0) return;

        for (const sub of this.subs) {
            const matched = relevant.filter(sub.match);
            if (matched.length === 0) continue;
            for (const p of matched) sub.pending.add(p);
            if (sub.timer) clearTimeout(sub.timer);
            sub.timer = setTimeout(() => {
                sub.timer = null;
                const batch = [...sub.pending];
                sub.pending.clear();
                sub.run(batch);
            }, sub.delayMs);
        }
    }
}
