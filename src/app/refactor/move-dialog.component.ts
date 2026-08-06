import { Component, computed, effect, input, output, signal } from '@angular/core';
import { baseName } from '../core/path';
import { buildMovePlan, applyMovePlan, MovePlan } from './move-module';
import type { RenameEdit } from './rename-module';

@Component({
    selector: 'app-move-dialog',
    standalone: true,
    templateUrl: './move-dialog.component.html',
    styleUrl: './refactor-dialog.component.scss',
})
export class MoveDialogComponent {
    readonly root = input.required<string>();
    readonly activeFile = input.required<string>();
    readonly close = output<void>();
    readonly done = output<string>();

    protected readonly destDir = signal('');
    protected readonly plan = signal<MovePlan | null>(null);
    protected readonly busy = signal(false);

    protected readonly baseName = computed(() => baseName(this.activeFile()));
    protected readonly noop = computed(() => {
        const p = this.plan();
        return p != null && p.newRel === p.oldRel;
    });
    protected readonly groups = computed<[string, RenameEdit[]][]>(() => {
        const map = new Map<string, RenameEdit[]>();
        for (const edit of this.plan()?.edits ?? []) {
            const list = map.get(edit.file) ?? [];
            list.push(edit);
            map.set(edit.file, list);
        }
        return [...map.entries()];
    });

    constructor() {
        effect((onCleanup) => {
            const destDir = this.destDir();
            const root = this.root();
            const activeFile = this.activeFile();
            let alive = true;
            const timer = setTimeout(() => {
                buildMovePlan(root, activeFile, destDir)
                    .then((p) => alive && this.plan.set(p))
                    .catch(() => alive && this.plan.set(null));
            }, 200);
            onCleanup(() => {
                alive = false;
                clearTimeout(timer);
            });
        });
    }

    protected onInput(value: string): void {
        this.destDir.set(value);
    }

    protected onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter') this.confirm();
        else if (e.key === 'Escape') this.close.emit();
    }

    protected async confirm(): Promise<void> {
        const plan = this.plan();
        if (!plan || this.busy() || plan.newRel === plan.oldRel) return;
        this.busy.set(true);
        try {
            this.done.emit(await applyMovePlan(this.root(), plan));
        } finally {
            this.busy.set(false);
        }
    }
}
