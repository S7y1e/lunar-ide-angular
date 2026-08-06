import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { resolveResource } from '@tauri-apps/api/path';
import { LuauLspClient } from './client';
import { registerLuauLsp } from './monaco-bridge';
import { setCurrentLspClient } from './lsp-registry';
import { buildConfigRoot } from './config';
import { discoverDefinitionFiles } from './discover-definitions';
import { pathToUri } from '../../core/monaco-uri';
import { SettingsService } from '../../core/settings.service';
import { SettingsValues } from '../../core/settings-store';
import { ProjectService } from '../../core/project.service';

const DEFINITIONS_RESOURCE = 'resources/globalTypes.PluginSecurity.d.luau';
const TESTEZ_RESOURCE = 'resources/testez.d.luau';

async function resolveBundled(resource: string): Promise<string | null> {
    try {
        return await resolveResource(resource);
    } catch (e) {
        console.warn('[luau-lsp] could not resolve', resource, e);
        return null;
    }
}

// FFlags are process-global and locked at server boot, so a change to any of
// these requires a full restart — pushing config does nothing.
const FFLAG_KEYS = [
    'luau-lsp.fflags.enableByDefault',
    'luau-lsp.fflags.enableNewSolver',
    'luau-lsp.fflags.sync',
    'luau-lsp.fflags.override',
];

const fflagSignature = (values: SettingsValues): string => JSON.stringify(FFLAG_KEYS.map((k) => values[k]));

// Angular port of use-luau-lsp.ts. Reacts to project.root() and
// settings.values() directly instead of the original's manual
// readSettings/subscribeSettings + "wait for project://opened" dance —
// ProjectService.snapshot() is already the single reactive source of truth
// here, so there's nothing to race.
@Injectable({ providedIn: 'root' })
export class LuauLspService {
    private readonly project = inject(ProjectService);
    private readonly settings = inject(SettingsService);

    readonly client = signal<LuauLspClient | null>(null);

    private dispose: () => void = () => {};
    private definitionsPaths: string[] = [];
    private discovered: Record<string, string> = {};
    private applyTimer: ReturnType<typeof setTimeout> | null = null;
    private fflagsSig = '';
    private currentRoot: string | null = null;

    constructor() {
        effect(() => {
            const root = this.project.root();
            untracked(() => {
                this.onRootChanged(root);
            });
        });

        effect(() => {
            const values = this.settings.values();
            untracked(() => {
                this.onSettingsChanged(values);
            });
        });
    }

    private getConfig(): Record<string, unknown> {
        const values = this.settings.values();
        const userDefs = (values['luau-lsp.types.definitionFiles'] as Record<string, string> | undefined) ?? {};
        const projectFile = this.project.snapshot()?.projectFile;
        return buildConfigRoot({
            ...values,
            // Discovered defs are a baseline; explicit user entries win.
            'luau-lsp.types.definitionFiles': { ...this.discovered, ...userDefs },
            ...(projectFile ? { 'luau-lsp.sourcemap.rojoProjectFile': projectFile } : {}),
        });
    }

    private async onRootChanged(root: string | null): Promise<void> {
        await this.teardown();
        this.currentRoot = root;
        if (!root) return;

        const [defs, found] = await Promise.all([resolveBundled(DEFINITIONS_RESOURCE), discoverDefinitionFiles(root)]);
        if (this.currentRoot !== root) return; // root changed again mid-await

        const testEz = this.project.snapshot()?.testEz;
        const testezDefs = testEz ? await resolveBundled(TESTEZ_RESOURCE) : null;
        if (this.currentRoot !== root) return;

        this.definitionsPaths = [defs, testezDefs].filter((p): p is string => !!p);
        this.discovered = found;
        this.fflagsSig = fflagSignature(this.settings.values());
        await this.spawn(root);
    }

    private async spawn(root: string): Promise<void> {
        this.dispose();
        this.dispose = () => {};
        const prev = this.client();
        this.client.set(null);
        await prev?.stop().catch(() => {});
        if (this.currentRoot !== root) return; // superseded while stopping the old client

        const client = new LuauLspClient(pathToUri(root), () => this.getConfig(), this.definitionsPaths);
        this.dispose = registerLuauLsp(client);
        setCurrentLspClient(client);
        this.client.set(client);
        try {
            await client.start();
        } catch (e) {
            console.error('[luau-lsp] failed to start', e);
        }
    }

    private onSettingsChanged(values: SettingsValues): void {
        if (!this.currentRoot) return;
        // Debounce: text fields write on every keystroke, and a respawn or a
        // full re-analysis per character would thrash the server.
        if (this.applyTimer) clearTimeout(this.applyTimer);
        this.applyTimer = setTimeout(() => {
            const sig = fflagSignature(values);
            const root = this.currentRoot;
            if (!root) return;
            if (sig !== this.fflagsSig) {
                this.fflagsSig = sig;
                this.spawn(root);
            } else {
                this.client()?.notifyConfigChanged();
            }
        }, 250);
    }

    private async teardown(): Promise<void> {
        if (this.applyTimer) {
            clearTimeout(this.applyTimer);
            this.applyTimer = null;
        }
        this.dispose();
        this.dispose = () => {};
        setCurrentLspClient(null);
        const prev = this.client();
        this.client.set(null);
        await prev?.stop().catch(() => {});
    }
}
