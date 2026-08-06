import { Component, computed, inject, input } from '@angular/core';
import { DataModelService } from '../data-model/data-model.service';
import { EditorGroupsService } from '../core/editor-groups.service';

type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'link'; text: string; dotPath: string }
    | { kind: 'unresolved'; text: string; dotPath: string };

// Matches the two ways Studio prints a source location:
//   Script 'ServerScriptService.main', Line 3   (stack frames)
//   ServerScriptService.main:3                   (inline error prefix)
const PATTERN = /Script '([^']+)', Line (\d+)|((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+):(\d+)/g;

@Component({
    selector: 'app-runtime-line',
    standalone: true,
    templateUrl: './runtime-line.component.html',
    styleUrl: './runtime-line.component.scss',
})
export class RuntimeLineComponent {
    readonly text = input.required<string>();

    private readonly dataModel = inject(DataModelService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly segments = computed<Segment[]>(() => {
        const text = this.text();
        const resolve = this.dataModel.resolve();
        const segments: Segment[] = [];
        let last = 0;
        let match: RegExpExecArray | null;

        PATTERN.lastIndex = 0;
        while ((match = PATTERN.exec(text)) !== null) {
            const dotPath = match[1] ?? match[3];
            if (match.index > last) segments.push({ kind: 'text', text: text.slice(last, match.index) });
            last = PATTERN.lastIndex;

            const isStackFrame = match[1] != null;
            if (resolve(dotPath)) {
                segments.push({ kind: 'link', text: match[0], dotPath });
            } else if (isStackFrame) {
                segments.push({ kind: 'unresolved', text: match[0], dotPath });
            } else {
                segments.push({ kind: 'text', text: match[0] });
            }
        }
        if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
        return segments;
    });

    // Line-jump isn't wired up yet (no goToLine/revealLine equivalent in the
    // Monaco wrapper) — every other panel in this port has the same gap, so
    // this just opens the file for now.
    protected open(dotPath: string): void {
        const rel = this.dataModel.resolve()(dotPath);
        if (rel) this.editorGroups.openFileAt(rel);
    }
}
