import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error';
export type ToastAction = { label: string; run: () => void };
export type Toast = {
    id: number;
    kind: ToastKind;
    message: string;
    detail?: string;
    action?: ToastAction;
};

@Injectable({ providedIn: 'root' })
export class ToastsService {
    readonly toasts = signal<Toast[]>([]);
    private nextId = 0;

    dismiss(id: number): void {
        this.toasts.update((list) => list.filter((t) => t.id !== id));
    }

    set(id: number, kind: ToastKind, message: string, detail?: string, autoMs?: number, action?: ToastAction): void {
        const next: Toast = { id, kind, message, detail, action };
        this.toasts.update((list) =>
            list.some((t) => t.id === id) ? list.map((t) => (t.id === id ? next : t)) : [...list, next],
        );
        if (autoMs) setTimeout(() => this.dismiss(id), autoMs);
    }

    push(kind: ToastKind, message: string, detail?: string, autoMs?: number, action?: ToastAction): number {
        const id = ++this.nextId;
        this.set(id, kind, message, detail, autoMs, action);
        return id;
    }
}
