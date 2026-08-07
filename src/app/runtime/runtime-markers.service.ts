import { Injectable, effect, inject } from '@angular/core';
import * as monaco from 'monaco-editor';
import { RuntimeBridgeService } from './runtime-bridge.service';
import { DataModelService } from '../data-model/data-model.service';
import { ProjectService } from '../core/project.service';
import { RuntimeDiagnostic, extractDiagnostics } from './diagnostics';

const OWNER = 'lunar-runtime';

const SEVERITY: Record<RuntimeDiagnostic['severity'], monaco.MarkerSeverity> = {
    error: monaco.MarkerSeverity.Error,
    warning: monaco.MarkerSeverity.Warning,
    info: monaco.MarkerSeverity.Info,
};

// Angular port of runtime/use-runtime-markers.ts: paints runtime diagnostics
// (from extractDiagnostics) as Monaco markers (squiggles + hover) on the
// source line. Markers live on a model, which only exists while the file is
// open, so they're re-applied whenever a model is created (file opened after
// the error landed).
@Injectable({ providedIn: 'root' })
export class RuntimeMarkersService {
    private readonly runtimeBridge = inject(RuntimeBridgeService);
    private readonly dataModel = inject(DataModelService);
    private readonly project = inject(ProjectService);

    private byUri = new Map<string, RuntimeDiagnostic[]>();

    constructor() {
        monaco.editor.onDidCreateModel(() => this.apply());

        effect(() => {
            const root = this.project.root();
            const diagnostics = root
                ? extractDiagnostics(this.runtimeBridge.messages(), this.dataModel.resolve(), root)
                : [];
            this.byUri = new Map<string, RuntimeDiagnostic[]>();
            for (const diagnostic of diagnostics) {
                // Re-parse through Monaco's own Uri so the map key matches
                // model.uri.toString() below — Monaco canonicalizes Windows
                // drive letters to lowercase and percent-encodes the colon on
                // serialization, which the raw pathToUri() string doesn't do.
                const key = monaco.Uri.parse(diagnostic.uri).toString();
                const list = this.byUri.get(key) ?? [];
                list.push(diagnostic);
                this.byUri.set(key, list);
            }
            this.apply();
        });
    }

    private apply(): void {
        for (const model of monaco.editor.getModels()) {
            const list = this.byUri.get(model.uri.toString()) ?? [];
            const markers = list.map((diagnostic) => {
                const line = Math.min(Math.max(diagnostic.line, 1), model.getLineCount());
                return {
                    startLineNumber: line,
                    endLineNumber: line,
                    startColumn: 1,
                    endColumn: model.getLineMaxColumn(line),
                    message: diagnostic.message,
                    severity: SEVERITY[diagnostic.severity],
                };
            });
            monaco.editor.setModelMarkers(model, OWNER, markers);
        }
    }
}
