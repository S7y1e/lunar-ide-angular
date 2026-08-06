import { Injectable, signal } from '@angular/core';

// Whether the Settings overlay is shown — lifted out of App so other features
// (the command palette's "Settings: Open" action) can trigger it too.
@Injectable({ providedIn: 'root' })
export class SettingsUiService {
    readonly open = signal(false);
}
