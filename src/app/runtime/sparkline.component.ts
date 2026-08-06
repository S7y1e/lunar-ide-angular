import { Component, computed, input } from '@angular/core';

@Component({
    selector: 'app-sparkline',
    standalone: true,
    templateUrl: './sparkline.component.html',
    styleUrl: './sparkline.component.scss',
})
export class SparklineComponent {
    readonly values = input.required<number[]>();

    protected readonly points = computed(() => {
        const values = this.values();
        if (values.length < 2) return '';
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const span = max - min || 1;
        return values
            .map((v, i) => {
                const x = (i / (values.length - 1)) * 100;
                const y = 30 - ((v - min) / span) * 28 - 1;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
    });
}
