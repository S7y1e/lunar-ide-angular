import { Component, input, output, signal } from '@angular/core';
import { chordFromEvent } from '../search/keybinds';

@Component({
    selector: 'app-keybind-field',
    standalone: true,
    templateUrl: './keybind-field.component.html',
    styleUrl: './keybind-field.component.scss',
})
export class KeybindFieldComponent {
    readonly value = input.required<string>();
    readonly valueChange = output<string>();

    protected readonly capturing = signal(false);

    protected onClick(): void {
        this.capturing.set(true);
    }

    protected onBlur(): void {
        this.capturing.set(false);
    }

    protected onKeyDown(e: KeyboardEvent): void {
        if (!this.capturing()) return;
        e.preventDefault();
        if (e.key === 'Escape') {
            this.capturing.set(false);
            return;
        }
        const chord = chordFromEvent(e);
        if (chord) {
            this.valueChange.emit(chord);
            this.capturing.set(false);
        }
    }

    protected clear(): void {
        this.valueChange.emit('');
    }
}
