import { Component, input, output } from '@angular/core';
import { Setting } from './setting';
import { KeybindFieldComponent } from './keybind-field.component';
import { StringListFieldComponent } from './string-list-field.component';
import { RecordFieldComponent } from './record-field.component';

// Multi-row controls need the full width, so they drop below the label
// instead of sitting in the right-hand control column.
const STACKED_TYPES = new Set(['string[]', 'record']);

// Angular port of settings-field.tsx (the generic per-Setting row + control
// dispatch) with its inline Toggle folded into the template.
@Component({
    selector: 'app-settings-field',
    standalone: true,
    imports: [KeybindFieldComponent, StringListFieldComponent, RecordFieldComponent],
    templateUrl: './settings-field.component.html',
    styleUrl: './settings-field.component.scss',
})
export class SettingsFieldComponent {
    readonly setting = input.required<Setting>();
    readonly value = input.required<unknown>();
    readonly modified = input.required<boolean>();
    readonly changed = output<unknown>();
    readonly reset = output<void>();

    protected get stacked(): boolean {
        return STACKED_TYPES.has(this.setting().type);
    }
}
