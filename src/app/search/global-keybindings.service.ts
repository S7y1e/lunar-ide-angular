import { Injectable, inject } from '@angular/core';
import { SettingsService } from '../core/settings.service';
import { PaletteService } from './palette.service';
import { BINDABLE, chordFromEvent, keybindKey } from './keybinds';

// Angular port of use-global-keybindings.ts: match a keyboard chord against
// the configured/default binding and run the matching palette command.
@Injectable({ providedIn: 'root' })
export class GlobalKeybindingsService {
    private readonly settings = inject(SettingsService);
    private readonly palette = inject(PaletteService);

    constructor() {
        window.addEventListener('keydown', (e) => this.onKey(e));
    }

    private onKey(e: KeyboardEvent): void {
        const chord = chordFromEvent(e);
        if (!chord) return;
        const values = this.settings.values();
        for (const bindable of BINDABLE) {
            const bound = (values[keybindKey(bindable.id)] as string) || bindable.defaultKey;
            if (bound && bound === chord) {
                const command = this.palette.commands().find((c) => c.id === bindable.id);
                if (command && command.enabled !== false) {
                    e.preventDefault();
                    command.run();
                }
                return;
            }
        }
    }
}
