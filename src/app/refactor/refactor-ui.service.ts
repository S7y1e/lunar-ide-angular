import { Injectable, signal } from '@angular/core';

// Lifts the rename/move dialog visibility out of the palette commands so any
// component can open them (mirrors setRenaming/setMoving lifted in index.tsx).
@Injectable({ providedIn: 'root' })
export class RefactorUiService {
    readonly renaming = signal(false);
    readonly moving = signal(false);
}
