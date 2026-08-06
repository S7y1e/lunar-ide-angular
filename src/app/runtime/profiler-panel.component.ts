import { Component, computed, effect, inject, signal } from '@angular/core';
import { RuntimeBridgeService } from './runtime-bridge.service';
import { DONE, parseSamples, sendProfile } from './profiler';
import { SparklineComponent } from './sparkline.component';

const DURATIONS = [3, 5, 10];

@Component({
    selector: 'app-profiler-panel',
    standalone: true,
    imports: [SparklineComponent],
    templateUrl: './profiler-panel.component.html',
    styleUrl: './profiler-panel.component.scss',
})
export class ProfilerPanelComponent {
    protected readonly bridge = inject(RuntimeBridgeService);
    protected readonly durations = DURATIONS;

    protected readonly seconds = signal(5);
    protected readonly sampling = signal(false);

    private readonly lines = computed(() => this.bridge.messages().map((m) => m.text));
    protected readonly samples = computed(() => parseSamples(this.lines()));

    protected readonly last = computed(() => this.samples()[this.samples().length - 1]);
    protected readonly cats = computed(() => {
        const last = this.last();
        return last ? Object.entries(last.cats).sort((a, b) => b[1] - a[1]).slice(0, 12) : [];
    });
    protected readonly maxCat = computed(() => this.cats()[0]?.[1] ?? 1);
    protected readonly memSeries = computed(() => this.samples().map((s) => s.mem));
    protected readonly hbSeries = computed(() => this.samples().map((s) => s.hb));

    constructor() {
        // Clear the "sampling" state once the done marker arrives.
        effect(() => {
            if (this.lines().some((l) => l.includes(DONE))) this.sampling.set(false);
        });
    }

    protected async run(): Promise<void> {
        this.sampling.set(true);
        try {
            await sendProfile(this.seconds());
        } catch {
            this.sampling.set(false);
        }
        // safety: clear even if the done marker never arrives
        setTimeout(() => this.sampling.set(false), (this.seconds() + 2) * 1000);
    }
}
