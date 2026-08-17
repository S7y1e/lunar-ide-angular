import { Component, inject } from '@angular/core';
import { PaletteItem, PaletteService, Scope } from './palette.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { highlightSegments } from './highlight';
import { fileIconFor } from '../file-tree/file-icons';
import { PaletteTabsComponent } from './palette-tabs.component';

const PLACEHOLDER: Record<Scope, string> = {
    all: 'Search Everywhere — files, symbols, actions, text',
    files: 'Search files',
    symbols: 'Search symbols',
    actions: 'Search actions',
    text: 'Search text in project',
};

@Component({
    selector: 'app-search-palette',
    standalone: true,
    imports: [PaletteTabsComponent],
    templateUrl: './search-palette.component.html',
    styleUrl: './search-palette.component.scss',
})
export class SearchPaletteComponent {
    protected readonly palette = inject(PaletteService);
    private readonly editorGroups = inject(EditorGroupsService);
    protected readonly placeholder = PLACEHOLDER;
    protected readonly highlightSegments = highlightSegments;
    protected readonly fileIconFor = fileIconFor;

    protected choose(index: number): void {
        const item = this.palette.items()[index];
        if (!item) return;
        if (item.kind === 'command') item.command.run();
        else if (item.kind === 'symbol') this.editorGroups.openFileAt(item.symbol.file);
        else if (item.kind === 'text') this.editorGroups.openFileAt(item.match.file);
        else this.editorGroups.openFile(item.file.path);
        this.palette.close();
    }

    protected onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.palette.moveActive(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.palette.moveActive(-1);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.palette.cycleScope(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.choose(this.palette.active());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.palette.close();
        }
    }

    protected textPreview(text: string): string {
        return text.trim().slice(0, 80);
    }

    protected itemKey(item: PaletteItem, i: number): string {
        if (item.kind === 'file') return `f:${item.file.path}`;
        if (item.kind === 'symbol') return `s:${item.symbol.file}:${item.symbol.line}:${i}`;
        if (item.kind === 'text') return `t:${item.match.file}:${item.match.line}:${i}`;
        return `c:${item.command.id}`;
    }
}
