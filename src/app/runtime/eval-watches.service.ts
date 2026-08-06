import { Injectable, signal } from '@angular/core';
import { listen } from '@tauri-apps/api/event';
import { runtimeEnqueue } from '../core/project-queries';

export type WatchExpr = { id: string; expr: string };
export type WatchResult = { value: string; ok: boolean };

type WatchPayload = { evalWatches?: { id: string; value: string; ok: boolean }[] };

// Re-send the watch list this often so a reloaded/reconnected plugin recovers
// it (commands are one-shot drains, lost if the plugin wasn't polling when sent).
const RESEND_MS = 3000;

// Angular port of use-eval-watches.ts.
@Injectable({ providedIn: 'root' })
export class EvalWatchesService {
    readonly watches = signal<WatchExpr[]>([]);
    readonly results = signal<Map<string, WatchResult>>(new Map());

    private idCounter = 0;

    constructor() {
        listen<WatchPayload>('runtime://message', (event) => {
            const incoming = event.payload.evalWatches;
            if (!incoming?.length) return;
            this.results.update((prev) => {
                const m = new Map(prev);
                for (const r of incoming) m.set(r.id, { value: r.value, ok: r.ok });
                return m;
            });
        });

        setInterval(() => {
            if (this.watches().length) this.send(this.watches());
        }, RESEND_MS);
    }

    private send(list: WatchExpr[]): void {
        runtimeEnqueue({ type: 'setWatches', watches: list }).catch(() => {});
    }

    add(expr: string): void {
        const trimmed = expr.trim();
        if (!trimmed) return;
        const next = [...this.watches(), { id: `w${++this.idCounter}`, expr: trimmed }];
        this.watches.set(next);
        this.send(next);
    }

    remove(id: string): void {
        const next = this.watches().filter((w) => w.id !== id);
        this.watches.set(next);
        this.send(next);
        this.results.update((prev) => {
            const m = new Map(prev);
            m.delete(id);
            return m;
        });
    }

    update(id: string, expr: string): void {
        const next = this.watches().map((w) => (w.id === id ? { ...w, expr } : w));
        this.watches.set(next);
        this.send(next);
    }
}
