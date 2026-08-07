import { Injectable, inject } from '@angular/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { EditorGroupsService } from './editor-groups.service';
import { LayoutService } from './layout.service';
import { SyncService } from '../sync/sync.service';

// Save dirty files and stop the sync server before the window closes, so the
// Rojo/Argon sidecar isn't orphaned holding its port. Each step is isolated so
// a failure can't trap the window open.
@Injectable({ providedIn: 'root' })
export class WindowCloseService {
    private readonly editorGroups = inject(EditorGroupsService);
    private readonly layout = inject(LayoutService);
    private readonly sync = inject(SyncService);

    constructor() {
        let win: ReturnType<typeof getCurrentWindow>;
        try {
            win = getCurrentWindow();
        } catch (e) {
            console.error('getCurrentWindow unavailable, skipping close handling', e);
            return;
        }
        win.onCloseRequested(async (event) => {
            event.preventDefault();
            try {
                this.layout.flush();
            } catch (e) {
                console.error('layout flush on close failed', e);
            }
            try {
                await this.editorGroups.flushSession();
            } catch (e) {
                console.error('session flush on close failed', e);
            }
            try {
                await this.editorGroups.saveAll();
            } catch (e) {
                console.error('save on close failed', e);
            }
            try {
                await this.sync.stop();
            } catch (e) {
                console.error('sync stop on close failed', e);
            }
            // destroy() bypasses onCloseRequested (close() would re-enter and
            // loop). Fall back to close() so a single failure can't trap it open.
            try {
                await win.destroy();
            } catch (e) {
                console.error('window destroy failed, falling back to close', e);
                await win.close();
            }
        });
    }
}
