import { Component, computed, inject } from '@angular/core';
import { ConnectionPhase, SyncBackend, SyncService } from './sync.service';

const STATUS_LABEL: Record<string, string> = { stopped: 'Stopped', running: 'Running', error: 'Error' };

function chip(phase: ConnectionPhase): { label: string; tone: string } {
    switch (phase) {
        case 'serving':
            return { label: 'Serving', tone: 'running' };
        case 'error':
            return { label: 'Connection error', tone: 'error' };
        default:
            return { label: 'Starting…', tone: 'warning' };
    }
}

@Component({
    selector: 'app-sync-panel',
    standalone: true,
    templateUrl: './sync-panel.component.html',
    styleUrl: './sync-panel.component.scss',
})
export class SyncPanelComponent {
    protected readonly sync = inject(SyncService);
    protected readonly statusLabel = STATUS_LABEL;

    protected readonly running = computed(() => this.sync.status() === 'running');
    protected readonly conn = computed(() => chip(this.sync.phase()));

    protected onBackendChange(e: Event): void {
        this.sync.setBackend((e.target as HTMLSelectElement).value as SyncBackend);
    }

    protected onPortChange(e: Event): void {
        const n = (e.target as HTMLInputElement).valueAsNumber;
        this.sync.setPort(n || 0);
    }

    protected toggle(): void {
        if (this.running()) this.sync.stop();
        else this.sync.start();
    }
}
