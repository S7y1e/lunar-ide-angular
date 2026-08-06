import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { ErrorGroup } from './error-group';
import { DataModelService } from '../data-model/data-model.service';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';

const CONTEXT_RADIUS = 2;

type SourceContext = { lines: { n: number; text: string }[]; target: number };

async function loadContext(root: string, relPath: string, line: number): Promise<SourceContext | null> {
    try {
        const abs = await join(root, ...relPath.split('/'));
        const text = await readTextFile(abs);
        const all = text.split('\n');
        const from = Math.max(0, line - 1 - CONTEXT_RADIUS);
        const to = Math.min(all.length - 1, line - 1 + CONTEXT_RADIUS);
        return {
            lines: all.slice(from, to + 1).map((t, i) => ({ n: from + i + 1, text: t })),
            target: line,
        };
    } catch {
        return null;
    }
}

// Strips the "X.Y:N: " prefix Roblox prepends to the error message text.
function stripLocationPrefix(msg: string): string {
    return msg.replace(/^(?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+:\d+:\s*/, '');
}

@Component({
    selector: 'app-error-card',
    standalone: true,
    templateUrl: './error-card.component.html',
    styleUrl: './error-card.component.scss',
})
export class ErrorCardComponent {
    readonly group = input.required<ErrorGroup>();

    private readonly project = inject(ProjectService);
    private readonly dataModel = inject(DataModelService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly expanded = signal(true);
    protected readonly ctx = signal<SourceContext | null>(null);
    protected readonly message = computed(() => stripLocationPrefix(this.group().message));

    protected readonly topFrame = computed(() =>
        this.group().frames.find((f) => this.dataModel.resolve()(f.dotPath) !== null),
    );

    constructor() {
        effect(() => {
            const frame = this.topFrame();
            const root = this.project.root();
            if (!frame || !root) {
                this.ctx.set(null);
                return;
            }
            const rel = this.dataModel.resolve()(frame.dotPath);
            if (!rel) {
                this.ctx.set(null);
                return;
            }
            loadContext(root, rel, frame.line).then((c) => this.ctx.set(c));
        });
    }

    protected resolvedPath(dotPath: string): string | null {
        return this.dataModel.resolve()(dotPath);
    }

    protected openFrame(dotPath: string): void {
        const rel = this.resolvedPath(dotPath);
        if (rel) this.editorGroups.openFileAt(rel);
    }
}
