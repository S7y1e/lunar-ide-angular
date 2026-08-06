import { Component, inject } from '@angular/core';
import { EventsService } from './events.service';
import { Signal } from '../core/project-queries';
import { EditorGroupsService } from '../core/editor-groups.service';
import { baseName } from '../core/path';

function kindColor(kind: string): string {
    switch (kind) {
        case 'RemoteEvent':
        case 'UnreliableRemoteEvent':
            return 'var(--accent)';
        case 'RemoteFunction':
            return 'var(--brand)';
        case 'BindableEvent':
        case 'BindableFunction':
            return 'var(--warning)';
        case 'module':
            return 'var(--muted)';
        default:
            return 'var(--icon)';
    }
}

@Component({
    selector: 'app-events-panel',
    standalone: true,
    templateUrl: './events-panel.component.html',
    styleUrl: './events-panel.component.scss',
})
export class EventsPanelComponent {
    protected readonly events = inject(EventsService);
    private readonly editorGroups = inject(EditorGroupsService);
    protected readonly baseName = baseName;
    protected readonly kindColor = kindColor;

    protected open(rel: string): void {
        this.editorGroups.openFileAt(rel);
    }
}
