import { Injectable, inject } from '@angular/core';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { ToastsService } from '../notifications/toasts.service';
import { readSettings } from './settings-store';
import { checkForUpdate } from './update-check';

// Angular port of lib/use-update-check.ts: on startup, offer to download a
// newer Lunar release unless the user turned the check off
// (`lunar.checkForUpdates`, exposed in Settings → editor-config.ts).
@Injectable({ providedIn: 'root' })
export class UpdateCheckService {
    private readonly toasts = inject(ToastsService);

    constructor() {
        void this.run();
    }

    private async run(): Promise<void> {
        const values = await readSettings().catch(() => ({}) as Record<string, unknown>);
        if (values['lunar.checkForUpdates'] === false) return;

        const info = await checkForUpdate();
        if (!info) return;
        this.toasts.push(
            'info',
            `Lunar v${info.version} is available`,
            'A newer version was published on GitHub.',
            undefined,
            {
                label: 'Download',
                run: () => {
                    openExternal(info.url).catch(() => {});
                },
            },
        );
    }
}
