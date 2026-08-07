import { Component, computed, inject } from '@angular/core';
import { ProblemsService } from './problems.service';
import { getDiagnostics } from '../code-editor/luau-lsp/diagnostics-store';
import { canonicalPath, uriToPath } from '../core/monaco-uri';
import { toRelative } from '../core/path';
import { baseName } from '../core/path';
import { ProjectService } from '../core/project.service';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';
import type { LspDiagnostic } from '../code-editor/luau-lsp/convert';

type FileProblems = { rel: string; diags: LspDiagnostic[] };

@Component({
    selector: 'app-problems-panel',
    standalone: true,
    templateUrl: './problems-panel.component.html',
    styleUrl: './problems-panel.component.scss',
})
export class ProblemsPanelComponent {
    private readonly problems = inject(ProblemsService);
    private readonly project = inject(ProjectService);
    private readonly navigation = inject(EditorNavigationService);
    protected readonly baseName = baseName;

    protected readonly files = computed<FileProblems[]>(() => {
        this.problems.version(); // reactive dependency on the diagnostics store
        const root = this.project.root();
        if (!root) return [];
        const canonicalRoot = canonicalPath(root);
        return [...getDiagnostics().entries()]
            .map(([uri, diags]) => ({ rel: toRelative(canonicalRoot, canonicalPath(uriToPath(uri))), diags }))
            .filter((f) => f.diags.length > 0)
            .sort((a, b) => a.rel.localeCompare(b.rel));
    });

    protected readonly total = computed(() => this.files().reduce((n, f) => n + f.diags.length, 0));

    protected isError(d: LspDiagnostic): boolean {
        return (d.severity ?? 1) === 1;
    }

    protected openAt(rel: string, d: LspDiagnostic): void {
        this.navigation.openFileAt(rel, d.range.start.line + 1, d.range.start.character + 1);
    }
}
