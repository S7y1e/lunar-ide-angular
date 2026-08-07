import { Injectable, effect, signal } from '@angular/core';
import { readSettings, writeSettings, SettingsValues } from './settings-store';

// Angular port of use-settings.ts: loads settings.json once, then persists
// every change back to disk (skipping the write before the initial load
// resolves, so a fresh app doesn't overwrite the file with {}).
@Injectable({ providedIn: 'root' })
export class SettingsService {
    readonly values = signal<SettingsValues>({});
    readonly loaded = signal(false);

    private writing = false;
    private pendingWrite: SettingsValues | null = null;

    constructor() {
        readSettings().then((v) => {
            this.values.set(v);
            this.loaded.set(true);
        });

        effect(() => {
            const values = this.values();
            if (this.loaded()) this.persist(values);
        });
    }

    // Serializes writes so a slower in-flight write can't resolve after a
    // newer one and clobber the file with a stale value — Tauri IPC doesn't
    // guarantee call order on completion. Coalesces to the latest values
    // seen while a write is in flight, rather than queuing every change.
    private persist(values: SettingsValues): void {
        if (this.writing) {
            this.pendingWrite = values;
            return;
        }
        this.writing = true;
        writeSettings(values)
            .catch((e) => console.error('[settings] write failed', e))
            .finally(() => {
                this.writing = false;
                if (this.pendingWrite) {
                    const next = this.pendingWrite;
                    this.pendingWrite = null;
                    this.persist(next);
                }
            });
    }

    setValue(key: string, value: unknown): void {
        this.values.update((prev) => ({ ...prev, [key]: value }));
    }

    resetValue(key: string): void {
        this.values.update((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }
}
