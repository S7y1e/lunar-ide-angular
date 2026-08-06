import { Component, input, output, signal } from '@angular/core';
import type { LspDocumentSymbol } from '../code-editor/luau-lsp/convert';

// LSP SymbolKind (1-based) → glyph.
const ICON: Record<number, string> = {
    2: '📦', // namespace
    5: '🏛', // class
    6: 'ƒ', // method
    7: '•', // property
    8: '▪', // field
    12: 'ƒ', // function
    13: 'x', // variable
    14: '#', // constant
    22: '🏛', // struct
};

@Component({
    selector: 'app-structure-node',
    standalone: true,
    imports: [StructureNodeComponent],
    templateUrl: './structure-node.component.html',
    styleUrl: './structure-node.component.scss',
})
export class StructureNodeComponent {
    readonly symbol = input.required<LspDocumentSymbol>();
    readonly depth = input.required<number>();
    readonly goTo = output<{ line: number; column: number }>();

    protected readonly open = signal(true);

    protected children(): LspDocumentSymbol[] {
        return this.symbol().children ?? [];
    }

    protected icon(): string {
        return ICON[this.symbol().kind] ?? 'ƒ';
    }

    protected onLabelClick(): void {
        const range = this.symbol().selectionRange ?? this.symbol().range;
        this.goTo.emit({ line: range.start.line + 1, column: range.start.character + 1 });
    }

    protected onChildGoTo(e: { line: number; column: number }): void {
        this.goTo.emit(e);
    }
}
