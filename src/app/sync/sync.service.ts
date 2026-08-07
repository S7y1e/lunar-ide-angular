import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Command, Child } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { ProjectService } from '../core/project.service';
import { SettingsService } from '../core/settings.service';

export type SyncBackend = 'rojo' | 'argon';
export type SyncStatus = 'stopped' | 'running' | 'error';
export type ConnectionPhase = 'starting' | 'serving' | 'error';

const MAX_LOG_LINES = 500;
const DEFAULT_PORT: Record<SyncBackend, number> = { rojo: 34872, argon: 8000 };
const SIDECAR: Record<SyncBackend, string> = { rojo: 'binaries/rojo', argon: 'binaries/argon' };

function isServingLine(line: string): boolean {
    const l = line.toLowerCase();
    return l.includes('serving on') || l.includes('server listening');
}

function serveArgs(backend: SyncBackend, port: number): string[] {
    if (backend === 'argon') return ['serve', '--port', String(port), '--yes', '--color', 'never'];
    return ['serve', '--port', String(port)];
}

function runArgonConfig(key: string, value: string, cwd: string): Promise<void> {
    const command = Command.sidecar('binaries/argon', ['config', key, value, '--config', 'workspace', '--yes'], {
        cwd,
    });
    return new Promise((resolve) => {
        command.on('close', () => resolve());
        command.on('error', () => resolve());
        command.spawn().catch(() => resolve());
    });
}

// Angular port of use-sync-server.ts.
@Injectable({ providedIn: 'root' })
export class SyncService {
    private readonly project = inject(ProjectService);
    private readonly settings = inject(SettingsService);

    readonly backend = signal<SyncBackend>('rojo');
    readonly status = signal<SyncStatus>('stopped');
    readonly phase = signal<ConnectionPhase>('starting');
    readonly logs = signal<string[]>([]);
    readonly port = signal(DEFAULT_PORT.rojo);

    private child: Child | null = null;
    private logBuffer: string[] = [];
    private flushTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        // Follow the project's declared sync backend (from its manifest) once
        // per project open, as long as nothing is running yet. Keyed only on
        // `root()` (read `snapshot()` via untracked so it doesn't retrigger
        // this) so an unrelated snapshot refresh — any `project://changed`
        // event, not just a project switch — can't silently revert a backend
        // the user picked manually via setBackend() while sync was stopped.
        effect(() => {
            const root = this.project.root();
            if (!root || this.child) return;
            const manifestBackend = untracked(() => this.project.snapshot()?.syncBackend);
            if (manifestBackend !== 'rojo' && manifestBackend !== 'argon') return;
            this.backend.set(manifestBackend);
            this.port.set(DEFAULT_PORT[manifestBackend]);
        });

        // Switching projects tears down any server started for the old one —
        // otherwise it would keep holding its port after the root changes.
        effect((onCleanup) => {
            this.project.root();
            onCleanup(() => this.teardown());
        });
    }

    setBackend(next: SyncBackend): void {
        if (this.child) return;
        this.backend.set(next);
        this.port.set(DEFAULT_PORT[next]);
    }

    setPort(port: number): void {
        this.port.set(port);
    }

    private append(line: string): void {
        if (isServingLine(line)) this.phase.set('serving');
        this.logBuffer.push(line);
        if (this.flushTimer !== null) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            const buffered = this.logBuffer;
            this.logBuffer = [];
            this.logs.update((prev) => [...prev, ...buffered].slice(-MAX_LOG_LINES));
        }, 120);
    }

    async start(): Promise<void> {
        if (this.child) return;
        const root = this.project.root();
        if (!root) return;
        this.logBuffer = [];
        this.logs.set([]);
        this.status.set('running');
        this.phase.set('starting');
        try {
            if (this.backend() === 'argon') {
                await this.applyArgonConfig(root);
                this.append('Lunar owns the sourcemap; disabling argon serve with_sourcemap.');
                await runArgonConfig('with_sourcemap', 'false', root);
            }
            const command = Command.sidecar(SIDECAR[this.backend()], serveArgs(this.backend(), this.port()), {
                cwd: root,
            });
            command.stdout.on('data', (line) => this.append(line));
            command.stderr.on('data', (line) => this.append(line));
            command.on('error', (error) => {
                this.append(String(error));
                this.status.set('error');
                this.phase.set('error');
            });
            command.on('close', () => {
                this.child = null;
                this.status.set('stopped');
                this.phase.set('starting');
            });
            this.child = await command.spawn();
            // Tie the sidecar to the app's lifetime so an abrupt exit can't
            // leave it orphaned holding the port. Best-effort.
            if (typeof this.child.pid === 'number') {
                invoke('assign_to_job', { pid: this.child.pid }).catch(() => {});
            }
        } catch (error) {
            this.append(String(error));
            this.status.set('error');
            this.phase.set('error');
        }
    }

    private async applyArgonConfig(cwd: string): Promise<void> {
        const values = this.settings.values();
        const keys = Object.keys(values).filter((key) => key.startsWith('argon.'));
        if (keys.length === 0) return;
        this.append(`Applying ${keys.length} Argon setting(s)...`);
        for (const fullKey of keys) {
            await runArgonConfig(fullKey.slice('argon.'.length), String(values[fullKey]), cwd);
        }
    }

    async stop(): Promise<void> {
        await this.child?.kill();
        this.child = null;
        this.status.set('stopped');
        this.phase.set('starting');
    }

    private async teardown(): Promise<void> {
        await this.child?.kill();
        this.child = null;
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.status.set('stopped');
    }
}
