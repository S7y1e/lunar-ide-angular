import { Component, input, output } from '@angular/core';
import { NavTool } from './registry';
import { TOOL_META } from './settings-meta';

// Angular port of settings-overview.tsx: landing page for "All settings"
// presenting each tool as a card with a blurb and its categories as jump-to
// chips, instead of dumping every field.
@Component({
    selector: 'app-settings-overview',
    standalone: true,
    templateUrl: './settings-overview.component.html',
    styleUrl: './settings-overview.component.scss',
})
export class SettingsOverviewComponent {
    readonly nav = input.required<NavTool[]>();
    readonly pick = output<string>();

    protected readonly toolMeta = TOOL_META;
}
