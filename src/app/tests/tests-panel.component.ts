import { Component, computed, inject } from '@angular/core';
import { TestResultsService } from './test-results.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { TestNodeComponent } from './test-node.component';

@Component({
    selector: 'app-tests-panel',
    standalone: true,
    imports: [TestNodeComponent],
    templateUrl: './tests-panel.component.html',
    styleUrl: './tests-panel.component.scss',
})
export class TestsPanelComponent {
    protected readonly tests = inject(TestResultsService);
    private readonly editorGroups = inject(EditorGroupsService);

    protected readonly pass = computed(() => this.tests.results()?.successCount ?? 0);
    protected readonly fail = computed(() => this.tests.results()?.failureCount ?? 0);
    protected readonly skip = computed(() => this.tests.results()?.skippedCount ?? 0);

    protected async onSetup(): Promise<void> {
        const spec = await this.tests.setup();
        if (spec) this.editorGroups.openFileAt(spec);
    }
}
