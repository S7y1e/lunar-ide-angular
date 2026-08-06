import { Component, input, output } from '@angular/core';
import { SCOPES, Scope } from './palette.service';

const LABEL: Record<Scope, string> = {
    all: 'All',
    files: 'Files',
    symbols: 'Symbols',
    actions: 'Actions',
    text: 'Text',
};

@Component({
    selector: 'app-palette-tabs',
    standalone: true,
    templateUrl: './palette-tabs.component.html',
    styleUrl: './palette-tabs.component.scss',
})
export class PaletteTabsComponent {
    readonly scope = input.required<Scope>();
    readonly select = output<Scope>();

    protected readonly scopes = SCOPES;
    protected readonly label = LABEL;
}
