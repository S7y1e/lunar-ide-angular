import { Component, computed, effect, input, output, signal } from '@angular/core';
import { baseName } from '../core/path';
import { buildRenamePlan, applyRenamePlan, RenamePlan, RenameEdit } from './rename-module';

@Component({
    selector: 'app-rename-dialog',
    standalone: true,
    templateUrl: './rename-dialog.component.html',
    styleUrl: './refactor-dialog.component.scss',
})
export class RenameDialogComponent {
    readonly root = input.required<string>();
    readonly activeFile = input.required<string>();
    readonly close = output<void>();
    readonly done = output<string>();

    protected readonly newName = signal('');
    protected readonly plan = signal<RenamePlan | null>(null);
    protected readonly busy = signal(false);

    protected readonly baseName = computed(() => baseName(this.activeFile()));
    protected readonly isModule = computed(() => this.newName().trim() === '' || this.plan() !== null);
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
            const name = this.newName();
            const root = this.root();
            const activeFile = this.activeFile();
            if (!name.trim()) {
                this.plan.set(null);
                return;
            }
            let alive = true;
            const timer = setTimeout(() => {
                buildRenamePlan(root, activeFile, name)
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
        this.newName.set(value);
    }

    protected onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter') this.confirm();
        else if (e.key === 'Escape') this.close.emit();
    }

    protected async confirm(): Promise<void> {
        const plan = this.plan();
        if (!plan || this.busy()) return;
        this.busy.set(true);
        try {
            const newAbs = await applyRenamePlan(this.root(), plan);
            this.done.emit(newAbs);
        } finally {
            this.busy.set(false);
        }
    }
}
