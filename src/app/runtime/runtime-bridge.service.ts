import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type RuntimeLevel = 'output' | 'info' | 'warning' | 'error';
export type RuntimeMessage = { text: string; type: RuntimeLevel; time: number };
type RuntimeStatus = { running: boolean; port: number };

const MAX_MESSAGES = 1000;
// How long to keep showing "in play-test" after the last running:true ping.
const PLAYTEST_TTL = 2000;

// Angular port of use-runtime-bridge.ts. The bridge itself is started once by
// the Rust backend at launch; this only reads its status and streams messages.
@Injectable({ providedIn: 'root' })
export class RuntimeBridgeService {
    readonly messages = signal<RuntimeMessage[]>([]);
    readonly running = signal(false);
    readonly port = signal(34900);
    // Whether Studio is currently in a play-test. The plugin reads this from
    // the edit context, where it's unstable during a Play Solo (flaps
    // true/false), so `running:true` is treated as a heartbeat: stay in
    // play-test while pings keep arriving, fall back to idle after PLAYTEST_TTL.
    readonly playtest = signal(false);

    private playtestTimer: ReturnType<typeof setTimeout> | null = null;
    // Studio can emit a burst of lines on play-test start; buffer and flush on
    // a timer so a burst costs one render instead of hundreds.
    private buffer: RuntimeMessage[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        invoke<{ running: boolean; port: number }>('runtime_bridge_status')
            .then((s) => {
                this.running.set(s.running);
                this.port.set(s.port);
            })
            .catch(() => {});

        listen<{ messages?: RuntimeMessage[]; running?: boolean }>('runtime://message', (event) => {
            // Only `true` pings matter; absence of them (not an explicit
            // `false`) is what means the play-test stopped.
            if (event.payload.running === true) {
                this.playtest.set(true);
                if (this.playtestTimer) clearTimeout(this.playtestTimer);
                this.playtestTimer = setTimeout(() => this.playtest.set(false), PLAYTEST_TTL);
            }
            this.push(event.payload.messages ?? []);
        });
    }

    private push(batch: RuntimeMessage[]): void {
        this.buffer.push(...batch);
        if (this.timer !== null) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            const buffered = this.buffer;
            this.buffer = [];
            this.messages.update((prev) => [...prev, ...buffered].slice(-MAX_MESSAGES));
        }, 120);
    }

    clear(): void {
        this.messages.set([]);
    }

    // Locally echo a line into the log (e.g. the eval input the user typed), so
    // the runtime panel reads like a REPL even before the round-trip returns.
    echo(text: string): void {
        this.push([{ text, type: 'info', time: Date.now() }]);
    }
}
