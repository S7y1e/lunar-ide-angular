import { Component, inject } from '@angular/core';
import { ToastsService } from './toasts.service';

@Component({
    selector: 'app-toast-host',
    standalone: true,
    templateUrl: './toast-host.component.html',
    styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
    protected readonly toasts = inject(ToastsService);

    protected runAction(id: number, run: () => void): void {
        run();
        this.toasts.dismiss(id);
    }
}
