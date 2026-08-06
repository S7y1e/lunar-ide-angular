import { Injectable, signal } from '@angular/core';

// Lifts the full-screen git graph overlay's visibility so it can be opened
// from the Git panel and rendered at the app root (mirrors settings/refactor).
@Injectable({ providedIn: 'root' })
export class GitGraphUiService {
    readonly open = signal(false);
}
