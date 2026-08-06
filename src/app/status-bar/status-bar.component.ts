import { Component, computed, inject } from '@angular/core';
import { SyncBackend } from '../sync/sync.service';
import { SyncService } from '../sync/sync.service';
import { LayoutService } from '../core/layout.service';
import { ProjectService } from '../core/project.service';
import { ActiveEditorService } from '../code-editor/active-editor.service';

const BACKEND_LABEL: Record<SyncBackend, string> = { rojo: 'Rojo', argon: 'Argon' };

type SyncInfo = { label: string; tone: string; title: string };

function syncInfo(status: string, backend: SyncBackend, phase: string, port: number): SyncInfo {
    if (status === 'error' || phase === 'error') {
        return { label: 'Sync error', tone: 'error', title: 'Open Sync panel' };
    }
    if (status === 'running') {
        const base = `${BACKEND_LABEL[backend]} · :${port}`;
        if (phase === 'serving') {
            return { label: base, tone: 'running', title: `${BACKEND_LABEL[backend]} serving on port ${port}` };
        }
        return { label: `${base} · starting`, tone: 'warning', title: `${BACKEND_LABEL[backend]} starting on port ${port}` };
    }
    return { label: 'Sync stopped', tone: 'stopped', title: 'Open Sync panel' };
}

// Angular port of apps/editor/status-bar/status-bar.tsx.
@Component({
    selector: 'app-status-bar',
    standalone: true,
    templateUrl: './status-bar.component.html',
    styleUrl: './status-bar.component.scss',
})
export class StatusBarComponent {
    protected readonly sync = inject(SyncService);
    protected readonly project = inject(ProjectService);
    protected readonly activeEditor = inject(ActiveEditorService);
    private readonly layout = inject(LayoutService);

    protected readonly info = computed(() =>
        syncInfo(this.sync.status(), this.sync.backend(), this.sync.phase(), this.sync.port()),
    );

    protected toggleSync(): void {
        this.layout.toggle('sync');
    }
}
