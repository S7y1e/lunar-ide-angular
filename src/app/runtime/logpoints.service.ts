import { Injectable, signal } from '@angular/core';
import { logpointsArm, logpointsDisarm } from '../core/project-queries';

export type Logpoint = {
    id: string;
    file: string; // project-relative, "/"-separated
    line: number;
    expr: string;
    includeStack: boolean;
};

// Angular port of use-logpoints.ts.
@Injectable({ providedIn: 'root' })
export class LogpointsService {
    readonly points = signal<Logpoint[]>([]);
    readonly armed = signal(false);

    private idCounter = 0;

    add(file: string, line: number, expr: string): void {
        const trimmed = expr.trim();
        if (!trimmed) return;
        if (this.points().some((p) => p.file === file && p.line === line && p.expr === trimmed)) return;
        this.points.update((prev) => [
            ...prev,
            { id: `lp${++this.idCounter}`, file, line, expr: trimmed, includeStack: false },
        ]);
    }

    remove(id: string): void {
        this.points.update((prev) => prev.filter((p) => p.id !== id));
    }

    toggleStack(id: string): void {
        this.points.update((prev) =>
            prev.map((p) => (p.id === id ? { ...p, includeStack: !p.includeStack } : p)),
        );
    }

    async arm(): Promise<void> {
        await logpointsArm(
            this.points().map(({ file, line, expr, includeStack }) => ({ file, line, expr, includeStack })),
        );
        this.armed.set(true);
    }

    async disarm(): Promise<void> {
        await logpointsDisarm();
        this.armed.set(false);
    }
}
