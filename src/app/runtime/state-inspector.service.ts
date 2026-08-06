import { Injectable, computed, signal } from '@angular/core';
import { listen } from '@tauri-apps/api/event';
import { ChangeKind, JsonValue, diff } from './state-diff';

export type Watch = {
    name: string;
    snapshot: JsonValue;
    changes: Map<string, ChangeKind>;
    changeSeq: number;
    t?: number;
};

type WatchMsg = { name: string; snapshot?: JsonValue; gone?: boolean; t?: number };
type StatePayload = { state?: { watches?: WatchMsg[] }; running?: boolean };

// Angular port of use-state-inspector.ts.
@Injectable({ providedIn: 'root' })
export class StateInspectorService {
    private readonly watchMap = signal<Map<string, Watch>>(new Map());
    private seqCounter = 0;

    readonly watches = computed(() => [...this.watchMap().values()]);

    constructor() {
        listen<StatePayload>('runtime://message', (event) => {
            // Don't auto-clear on running:false — the plugin's run flag flaps
            // during a Play Solo, which would wipe watches mid-test.
            const w = event.payload.state?.watches;
            if (w && w.length) this.apply(w);
        });
    }

    private apply(incoming: WatchMsg[]): void {
        this.watchMap.update((prev) => {
            const next = new Map(prev);
            for (const w of incoming) {
                if (w.gone) {
                    next.delete(w.name);
                    continue;
                }
                const old = next.get(w.name);
                const snap = w.snapshot ?? null;
                const changes = old ? diff(old.snapshot, snap, w.name) : new Map<string, ChangeKind>();
                next.set(w.name, {
                    name: w.name,
                    snapshot: snap,
                    changes,
                    changeSeq: ++this.seqCounter,
                    t: w.t,
                });
            }
            return next;
        });
    }

    clear(): void {
        this.watchMap.set(new Map());
    }
}
