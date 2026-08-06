import { Injectable, signal } from '@angular/core';
import { subscribeDiagnostics, diagnosticsVersion } from '../code-editor/luau-lsp/diagnostics-store';

// Signal wrapper around diagnostics-store.ts's plain module-level pub-sub
// (mirrors React's useSyncExternalStore(subscribeDiagnostics, diagnosticsVersion)).
@Injectable({ providedIn: 'root' })
export class ProblemsService {
    readonly version = signal(diagnosticsVersion());

    constructor() {
        subscribeDiagnostics(() => this.version.set(diagnosticsVersion()));
    }
}
