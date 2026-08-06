import { Injectable, effect, inject, signal } from '@angular/core';
import { Command } from '@tauri-apps/plugin-shell';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { ProjectService } from '../core/project.service';

export type RokitTool = { name: string; spec: string };

const MAX_LOG_LINES = 500;

function parseTools(toml: string): RokitTool[] {
    const tools: RokitTool[] = [];
    let inTools = false;
    for (const raw of toml.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('[')) {
            inTools = line === '[tools]';
            continue;
        }
        if (!inTools || !line || line.startsWith('#')) continue;
        const match = /^([\w-]+)\s*=\s*"([^"]+)"/.exec(line);
        if (match) tools.push({ name: match[1], spec: match[2] });
    }
    return tools;
}

function removeToolLine(toml: string, name: string): string {
    let inTools = false;
    const kept: string[] = [];
    for (const raw of toml.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('[')) {
            inTools = line === '[tools]';
            kept.push(raw);
            continue;
        }
        const match = /^([\w-]+)\s*=/.exec(line);
        if (inTools && match && match[1] === name) continue;
        kept.push(raw);
    }
    return kept.join('\n');
}

function setToolVersionLine(toml: string, name: string, version: string): string {
    let inTools = false;
    return toml
        .split(/\r?\n/)
        .map((raw) => {
            const line = raw.trim();
            if (line.startsWith('[')) {
                inTools = line === '[tools]';
                return raw;
            }
            const match = /^([\w-]+)\s*=\s*"([^"]+)"/.exec(line);
            if (inTools && match && match[1] === name) {
                const spec = match[2];
                const at = spec.lastIndexOf('@');
                const repo = at < 0 ? spec : spec.slice(0, at);
                return `${name} = "${repo}@${version}"`;
            }
            return raw;
        })
        .join('\n');
}

// Angular port of use-rokit.ts + use-online-status.ts.
@Injectable({ providedIn: 'root' })
export class ToolchainService {
    private readonly project = inject(ProjectService);

    readonly tools = signal<RokitTool[]>([]);
    readonly hasManifest = signal(false);
    readonly busy = signal(false);
    readonly logs = signal<string[]>([]);
    readonly online = signal(navigator.onLine);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
        window.addEventListener('online', () => this.online.set(true));
        window.addEventListener('offline', () => this.online.set(false));
    }

    private append(line: string): void {
        this.logs.update((prev) => [...prev, line].slice(-MAX_LOG_LINES));
    }

    async refresh(): Promise<void> {
        const root = this.project.root();
        if (!root) return;
        try {
            const manifest = await join(root, 'rokit.toml');
            this.tools.set(parseTools(await readTextFile(manifest)));
            this.hasManifest.set(true);
        } catch {
            this.tools.set([]);
            this.hasManifest.set(false);
        }
    }

    private run(args: string[]): Promise<void> {
        const root = this.project.root();
        return new Promise((resolve) => {
            if (!root) return resolve();
            const command = Command.sidecar('binaries/rokit', args, { cwd: root });
            command.stdout.on('data', (l) => this.append(l));
            command.stderr.on('data', (l) => this.append(l));
            command.on('error', (error) => {
                this.append(String(error));
                resolve();
            });
            command.on('close', () => resolve());
            command.spawn().catch((error) => {
                this.append(String(error));
                resolve();
            });
        });
    }

    private async exec(args: string[]): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        await this.run(args);
        await this.refresh();
        this.busy.set(false);
    }

    install(): Promise<void> {
        return this.exec(['install', '--no-trust-check']);
    }
    update(): Promise<void> {
        return this.exec(['update']);
    }
    init(): Promise<void> {
        return this.exec(['init']);
    }

    async remove(name: string): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        const root = this.project.root();
        try {
            if (root) {
                const manifest = await join(root, 'rokit.toml');
                const text = await readTextFile(manifest);
                await writeTextFile(manifest, removeToolLine(text, name));
                this.append(`Removed ${name} from rokit.toml`);
            }
        } catch (error) {
            this.append(String(error));
        }
        await this.refresh();
        this.busy.set(false);
    }

    async add(tool: string): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        await this.run(['trust', tool.split('@')[0]]);
        await this.run(['add', tool, '--force']);
        await this.refresh();
        this.busy.set(false);
    }

    async setVersion(name: string, version: string): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        const root = this.project.root();
        try {
            if (root) {
                const manifest = await join(root, 'rokit.toml');
                const text = await readTextFile(manifest);
                await writeTextFile(manifest, setToolVersionLine(text, name, version));
                this.append(`Set ${name} to ${version}`);
            }
        } catch (error) {
            this.append(String(error));
        }
        await this.run(['install', '--no-trust-check']);
        await this.refresh();
        this.busy.set(false);
    }
}
