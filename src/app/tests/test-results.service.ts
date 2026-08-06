import { Injectable, computed, inject, signal } from '@angular/core';
import { listen } from '@tauri-apps/api/event';
import { TestResults, runtimeEnqueue, setupTestez } from '../core/project-queries';
import { ProjectService } from '../core/project.service';

// Give up waiting on Studio after this long, so a missing/idle plugin surfaces
// an error instead of a spinner that never resolves.
const TIMEOUT_MS = 15000;

// Angular port of use-test-results.ts.
@Injectable({ providedIn: 'root' })
export class TestResultsService {
    private readonly project = inject(ProjectService);

    readonly results = signal<TestResults | null>(null);
    readonly running = signal(false);
    readonly setupLog = signal<string | null>(null);
    readonly busy = signal(false);

    readonly configured = computed(() => {
        const snap = this.project.snapshot();
        return !!snap?.testEz && (snap.testRoots?.length ?? 0) > 0;
    });

    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        listen<{ testResults?: TestResults }>('runtime://message', (e) => {
            if (!e.payload.testResults) return;
            this.clearTimer();
            this.results.set(e.payload.testResults);
            this.running.set(false);
        });
    }

    private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    // One-click onboarding: install TestEZ, seed a spec, configure lunar.toml.
    // Returns the created spec's relative path (if any) so the caller can open it.
    async setup(): Promise<string | null> {
        this.busy.set(true);
        this.setupLog.set(null);
        try {
            const res = await setupTestez();
            this.setupLog.set(res.log);
            return res.specFile;
        } catch (e) {
            this.setupLog.set(String(e));
            return null;
        } finally {
            this.busy.set(false);
        }
    }

    async run(): Promise<void> {
        const snap = this.project.snapshot();
        if (!snap?.testEz || (snap.testRoots ?? []).length === 0) {
            this.results.set({ error: 'Set [test] testez + roots in lunar.toml to run TestEZ' });
            this.running.set(false);
            return;
        }
        this.results.set(null);
        this.running.set(true);
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.running.set(false);
            this.results.set({ error: 'No response from Studio — is the Lunar bridge plugin running?' });
        }, TIMEOUT_MS);
        await runtimeEnqueue({ type: 'runTests', testez: snap.testEz, roots: snap.testRoots }).catch(() => {});
    }
}
