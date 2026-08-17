import { Injectable, effect, inject } from '@angular/core';
import * as monaco from 'monaco-editor';
import { InsightFinding, fixFor } from '../core/project-queries';
import { canonicalPath, uriToPath } from '../core/monaco-uri';
import { toRelative } from '../core/path';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { InsightsService } from './insights.service';

const OWNER = 'lunar-insights';

// Angular port of the insights marker effect in editor/index.tsx plus
// insights/fixes.ts. Two halves of one feature: findings become squiggles on
// the active file, and the line-deletable ones also become Monaco quick-fixes
// (the lightbulb) so they can be applied without leaving the editor.
@Injectable({ providedIn: 'root' })
export class InsightsMarkersService {
    private readonly insights = inject(InsightsService);
    private readonly project = inject(ProjectService);
    private readonly editorGroups = inject(EditorGroupsService);

    // Per-file line-deletable findings, read by the code-action provider.
    private readonly byFile = new Map<string, InsightFinding[]>();
    private staleSub: monaco.IDisposable | null = null;

    constructor() {
        this.registerProvider();

        effect(() => {
            const root = this.project.root();
            const activeFile = this.editorGroups.activeFile();
            const insights = this.insights.insights();

            this.staleSub?.dispose();
            this.staleSub = null;
            for (const m of monaco.editor.getModels()) monaco.editor.setModelMarkers(m, OWNER, []);
            this.byFile.clear();

            if (!root || !activeFile || !insights) return;
            const activeRel = toRelative(root, activeFile);
            const model = monaco.editor
                .getModels()
                .find((m) => canonicalPath(uriToPath(m.uri.toString())) === canonicalPath(activeFile));
            if (!model) return;

            const mine = insights.findings.filter((f) => f.file === activeRel);
            const lineFixes = mine.filter((f) => fixFor(f.category)?.kind === 'delete-line');
            if (lineFixes.length) this.byFile.set(activeRel, lineFixes);

            monaco.editor.setModelMarkers(
                model,
                OWNER,
                mine
                    // luau-lsp already squiggles unused locals (yellow); don't
                    // double-mark them blue. The finding stays in the Insights
                    // panel + lightbulb quick-fix.
                    .filter((f) => f.category !== 'unused-require')
                    .map((f) => ({
                        severity:
                            f.severity === 'info'
                                ? monaco.MarkerSeverity.Info
                                : monaco.MarkerSeverity.Warning,
                        message: f.message,
                        startLineNumber: f.line,
                        startColumn: 1,
                        endLineNumber: f.line,
                        endColumn: 1000,
                    })),
            );

            // Insights are computed from disk; once the buffer diverges (typing,
            // or a rename/move rewriting the file) these squiggles are stale, so
            // drop them immediately. The next save refreshes insights and
            // re-marks accurately.
            this.staleSub = model.onDidChangeContent(() =>
                monaco.editor.setModelMarkers(model, OWNER, []),
            );
        });
    }

    // Surface line-deletable fixes as Monaco quick-fixes (lightbulb). Done as a
    // model edit so the open editor stays consistent and undo works.
    private registerProvider(): void {
        const provider: monaco.languages.CodeActionProvider = {
            provideCodeActions: (model, range) => {
                const root = this.project.root();
                const path = uriToPath(model.uri.toString());
                const rel = root && path ? toRelative(root, path) : null;
                const items = rel ? this.byFile.get(rel) : null;
                const actions = (items ?? [])
                    .filter((f) => f.line >= range.startLineNumber && f.line <= range.endLineNumber)
                    .map<monaco.languages.CodeAction>((f) => ({
                        title: fixFor(f.category)!.label,
                        kind: 'quickfix',
                        edit: {
                            edits: [
                                {
                                    resource: model.uri,
                                    versionId: model.getVersionId(),
                                    textEdit: {
                                        range: new monaco.Range(f.line, 1, f.line + 1, 1),
                                        text: '',
                                    },
                                },
                            ],
                        },
                    }));
                return { actions, dispose(): void {} };
            },
        };
        for (const lang of ['lua', 'luau']) {
            monaco.languages.registerCodeActionProvider(lang, provider);
        }
    }
}
