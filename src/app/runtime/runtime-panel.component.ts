import { Component, computed, inject, signal } from '@angular/core';
import { RuntimeBridgeService } from './runtime-bridge.service';
import { isEngineNoise, isInternalLine } from './runtime-filter';
import { groupMessages } from './error-group';
import { ErrorCardComponent } from './error-card.component';
import { RuntimeLineComponent } from './runtime-line.component';
import { runtimeEnqueue } from '../core/project-queries';

@Component({
    selector: 'app-runtime-panel',
    standalone: true,
    imports: [ErrorCardComponent, RuntimeLineComponent],
    templateUrl: './runtime-panel.component.html',
    styleUrl: './runtime-panel.component.scss',
})
export class RuntimePanelComponent {
    protected readonly bridge = inject(RuntimeBridgeService);

    protected readonly hideNoise = signal(true);
    protected readonly filter = signal('');
    protected readonly evalInput = signal('');

    protected readonly filtered = computed(() => {
        const needle = this.filter().trim().toLowerCase();
        return this.bridge.messages().filter((m) => {
            if (isInternalLine(m.text)) return false;
            if (this.hideNoise() && isEngineNoise(m.text)) return false;
            if (needle && !m.text.toLowerCase().includes(needle)) return false;
            return true;
        });
    });

    protected readonly grouped = computed(() => groupMessages(this.filtered()));
    protected readonly hidden = computed(() => this.bridge.messages().length - this.filtered().length);

    protected submitEval(): void {
        const code = this.evalInput().trim();
        if (!code || !this.bridge.running()) return;
        this.bridge.echo(`> ${code}`);
        runtimeEnqueue({ type: 'eval', code }).catch(() => {});
        this.evalInput.set('');
    }
}
