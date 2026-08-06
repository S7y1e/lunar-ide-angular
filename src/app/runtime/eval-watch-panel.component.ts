import { Component, inject, signal } from '@angular/core';
import { EvalWatchesService } from './eval-watches.service';
import { RuntimeBridgeService } from './runtime-bridge.service';

@Component({
    selector: 'app-eval-watch-panel',
    standalone: true,
    templateUrl: './eval-watch-panel.component.html',
    styleUrl: './eval-watch-panel.component.scss',
})
export class EvalWatchPanelComponent {
    protected readonly watcher = inject(EvalWatchesService);
    protected readonly bridge = inject(RuntimeBridgeService);
    protected readonly draft = signal('');

    protected submit(): void {
        if (!this.draft().trim()) return;
        this.watcher.add(this.draft());
        this.draft.set('');
    }
}
