import { Injectable, effect, signal } from '@angular/core';
import { readSettings, writeSettings, SettingsValues } from './settings-store';

// Angular port of use-settings.ts: loads settings.json once, then persists
// every change back to disk (skipping the write before the initial load
// resolves, so a fresh app doesn't overwrite the file with {}).
@Injectable({ providedIn: 'root' })
export class SettingsService {
    readonly values = signal<SettingsValues>({});
    readonly loaded = signal(false);

    constructor() {
        readSettings().then((v) => {
            this.values.set(v);
            this.loaded.set(true);
        });

        effect(() => {
            const values = this.values();
            if (this.loaded()) writeSettings(values);
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
