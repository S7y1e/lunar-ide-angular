import { Component, inject, input } from '@angular/core';
import { TestNode } from '../core/project-queries';
import { parseError } from './test-error';
import { DataModelService } from '../data-model/data-model.service';
import { EditorGroupsService } from '../core/editor-groups.service';

const ICON: Record<string, string> = { Success: '✓', Failure: '✗', Skipped: '○' };

@Component({
    selector: 'app-test-node',
    standalone: true,
    imports: [TestNodeComponent],
    templateUrl: './test-node.component.html',
    styleUrl: './test-node.component.scss',
})
export class TestNodeComponent {
    readonly node = input.required<TestNode>();
    readonly depth = input.required<number>();

    private readonly dataModel = inject(DataModelService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected icon(status: string): string {
        return ICON[status] ?? '•';
    }

    protected statusClass(status: string): string {
        return status.toLowerCase();
    }

    protected parseError(err: string) {
        return parseError(err);
    }

    protected openFrame(dotPath: string): void {
        const rel = this.dataModel.resolve()(dotPath);
        if (rel) this.editorGroups.openFileAt(rel);
    }
}
