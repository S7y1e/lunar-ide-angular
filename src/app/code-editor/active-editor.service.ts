import { Injectable, signal } from '@angular/core';
import type * as monaco from 'monaco-editor';

// The app has exactly one Monaco editor instance (tabs reuse it, switching
// models instead of mounting a new editor per file) — this is how services
// outside code-editor/ (navigation, LSP-driven "reveal this location") reach
// it without threading a ref through every layer.
export type CursorPosition = { line: number; column: number };

@Injectable({ providedIn: 'root' })
export class ActiveEditorService {
    readonly editor = signal<monaco.editor.IStandaloneCodeEditor | null>(null);
    readonly cursor = signal<CursorPosition | null>(null);
}
