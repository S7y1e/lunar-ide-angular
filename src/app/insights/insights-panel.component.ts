import { Component, computed, inject } from '@angular/core';
import { InsightsService } from './insights.service';
import { InsightFinding, applyInsightFix, fixFor } from '../core/project-queries';
import { EditorGroupsService } from '../core/editor-groups.service';

const CATEGORIES: { id: string; label: string }[] = [
    { id: 'orphan', label: 'Orphan modules' },
    { id: 'unused-require', label: 'Unused requires' },
    { id: 'cycle', label: 'Require cycles' },
    { id: 'layer', label: 'Layer violations' },
    { id: 'dangling-event', label: 'Dangling events' },
    { id: 'unresolved', label: 'Unresolved requires' },
];

const dirOf = (rel: string): string => {
    const i = rel.lastIndexOf('/');
    return i < 0 ? '' : rel.slice(0, i);
};

@Component({
    selector: 'app-insights-panel',
    standalone: true,
    templateUrl: './insights-panel.component.html',
    styleUrl: './insights-panel.component.scss',
})
export class InsightsPanelComponent {
    protected readonly insights = inject(InsightsService);
    private readonly editorGroups = inject(EditorGroupsService);
    protected readonly dirOf = dirOf;
    protected readonly fixFor = fixFor;

    protected readonly findings = computed(() => this.insights.insights()?.findings ?? []);

    protected readonly groups = computed(() => {
        const findings = this.findings();
        return CATEGORIES.map((c) => ({ ...c, items: findings.filter((f) => f.category === c.id) })).filter(
            (g) => g.items.length > 0,
        );
    });

    protected open(f: InsightFinding): void {
        this.editorGroups.openFileAt(f.file);
    }

    protected async fixAndRefresh(f: InsightFinding): Promise<void> {
        try {
            await applyInsightFix(f);
            this.insights.refresh();
        } catch {
            // surfaced by the next manual refresh anyway
        }
    }
}
