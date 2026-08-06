import { Injectable, inject } from '@angular/core';
import { Command } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { ProjectService } from '../core/project.service';
import { SyncService, SyncBackend } from '../sync/sync.service';
import { ToastsService } from '../notifications/toasts.service';

const SIDECAR: Record<SyncBackend, string> = { rojo: 'binaries/rojo', argon: 'binaries/argon' };

function buildArgs(backend: SyncBackend, projectFile: string, output: string): string[] {
    if (backend === 'argon') return ['build', projectFile, '--output', output, '--yes', '--color', 'never'];
    return ['build', projectFile, '--output', output, '--color', 'never'];
}

// Angular port of use-build.ts + use-test.ts.
@Injectable({ providedIn: 'root' })
export class BuildService {
    private readonly project = inject(ProjectService);
    private readonly sync = inject(SyncService);
    private readonly toasts = inject(ToastsService);

    async build(): Promise<void> {
        const root = this.project.root();
        if (!root) return;
        const snapshot = this.project.snapshot();
        const projectFile = snapshot?.projectFile ?? 'default.project.json';
        const output = snapshot?.buildOutput ?? `${snapshot?.name ?? 'place'}.rbxl`;
        const backend = this.sync.backend();

        const id = this.toasts.push('info', `Building ${output}…`);
        let stderr = '';

        const command = Command.sidecar(SIDECAR[backend], buildArgs(backend, projectFile, output), { cwd: root });
        command.stderr.on('data', (line) => {
            stderr += line;
        });
        command.on('close', (data) => {
            if (data.code === 0) {
                this.toasts.set(id, 'success', `Built ${output}`, undefined, 5000);
            } else {
                this.toasts.set(id, 'error', 'Build failed', stderr.trim());
            }
        });
        command.on('error', (error) => {
            this.toasts.set(id, 'error', 'Build failed', String(error));
        });

        try {
            const child = await command.spawn();
            if (typeof child.pid === 'number') {
                invoke('assign_to_job', { pid: child.pid }).catch(() => {});
            }
        } catch (error) {
            this.toasts.set(id, 'error', 'Build failed', String(error));
        }
    }

    async test(): Promise<void> {
        const id = this.toasts.push('info', 'Running tests…');
        try {
            const result = await invoke<{ code: number; output: string }>('project_run_test');
            const detail = result.output.trim() || undefined;
            if (result.code === 0) {
                this.toasts.set(id, 'success', 'Tests passed', detail, 6000);
            } else {
                this.toasts.set(id, 'error', 'Tests failed', detail);
            }
        } catch (error) {
            this.toasts.set(id, 'error', 'Test run failed', String(error));
        }
    }
}
