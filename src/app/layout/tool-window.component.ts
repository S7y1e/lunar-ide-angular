import { Component, inject, input } from '@angular/core';
import { ToolId } from '../core/layout.types';
import { LayoutService } from '../core/layout.service';
import { ProjectService } from '../core/project.service';
import { FileTreeComponent } from '../file-tree/file-tree.component';
import { GitPanelComponent } from '../git/git-panel.component';
import { TodoPanelComponent } from '../todo/todo-panel.component';
import { FindPanelComponent } from '../find/find-panel.component';
import { TerminalComponent } from '../terminal/terminal.component';
import { DependenciesPanelComponent } from '../dependencies/dependencies-panel.component';
import { EventsPanelComponent } from '../events/events-panel.component';
import { ToolchainPanelComponent } from '../toolchain/toolchain-panel.component';
import { InsightsPanelComponent } from '../insights/insights-panel.component';
import { PackagesPanelComponent } from '../packages/packages-panel.component';
import { RuntimePanelComponent } from '../runtime/runtime-panel.component';
import { EvalWatchPanelComponent } from '../runtime/eval-watch-panel.component';
import { LogpointPanelComponent } from '../runtime/logpoint-panel.component';
import { StatePanelComponent } from '../runtime/state-panel.component';
import { ProfilerPanelComponent } from '../runtime/profiler-panel.component';
import { DataModelPanelComponent } from '../data-model/data-model-panel.component';
import { SyncPanelComponent } from '../sync/sync-panel.component';
import { TestsPanelComponent } from '../tests/tests-panel.component';
import { StructurePanelComponent } from '../structure/structure-panel.component';
import { HierarchyPanelComponent } from '../hierarchy/hierarchy-panel.component';
import { CallHierarchyPanelComponent } from '../callhierarchy/call-hierarchy-panel.component';
import { UsagesPanelComponent } from '../usages/usages-panel.component';
import { ProblemsPanelComponent } from '../problems/problems-panel.component';
import { ACTIVITY_VIEWS } from '../activity-bar/activity-views';

// Render a tool window's content by id — keyed by tool so any tool can dock
// anywhere. Everything not listed here is a placeholder until it's ported.
@Component({
    selector: 'app-tool-window',
    standalone: true,
    imports: [
        FileTreeComponent,
        GitPanelComponent,
        TodoPanelComponent,
        FindPanelComponent,
        TerminalComponent,
        DependenciesPanelComponent,
        EventsPanelComponent,
        ToolchainPanelComponent,
        InsightsPanelComponent,
        PackagesPanelComponent,
        RuntimePanelComponent,
        EvalWatchPanelComponent,
        LogpointPanelComponent,
        StatePanelComponent,
        ProfilerPanelComponent,
        DataModelPanelComponent,
        SyncPanelComponent,
        TestsPanelComponent,
        StructurePanelComponent,
        HierarchyPanelComponent,
        CallHierarchyPanelComponent,
        UsagesPanelComponent,
        ProblemsPanelComponent,
    ],
    templateUrl: './tool-window.component.html',
    styleUrl: './tool-window.component.scss',
})
export class ToolWindowComponent {
    readonly id = input.required<ToolId>();
    protected readonly project = inject(ProjectService);
    protected readonly layout = inject(LayoutService);

    protected label(): string {
        return ACTIVITY_VIEWS.find((v) => v.id === this.id())?.label ?? this.id();
    }

    protected glyph(): string {
        return ACTIVITY_VIEWS.find((v) => v.id === this.id())?.glyph ?? '❔';
    }
}
