import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { clientAgentInstall, clientAgentRemove, studioPlay } from '../core/project-queries';
import { ProjectService } from '../core/project.service';
import { ToastsService } from '../notifications/toasts.service';
import { LogpointsService } from './logpoints.service';

// Let the sync server push the injected logpoint lines to Studio before play
// starts — server scripts run instantly, so without this wait the run uses the
// pre-injection files and the logpoints are lost.
const SYNC_SETTLE_MS = 1000;

// Angular port of the studioPlay handler in the original editor/index.tsx.
// Logpoints arm/disarm automatically around a play-test: the prints go in right
// before Play and are stripped on Stop, so the user never arms by hand and the
// source stays clean except while actually running.
@Injectable({ providedIn: 'root' })
export class StudioPlayService {
    private readonly logpoints = inject(LogpointsService);
    private readonly toasts = inject(ToastsService);
    private readonly project = inject(ProjectService);

    // Play holds for a second while sync settles; without this the button can be
    // clicked again into a second (conflicting) install/play.
    readonly busy = signal(false);

    constructor() {
        // Strip any logpoint prints / client agent left in source by a previous
        // session or crash, once the project is open. Keeps the tree clean.
        effect(() => {
            if (!this.project.root()) return;
            untracked(() => {
                this.logpoints.disarm().catch(() => {});
                clientAgentRemove().catch(() => {});
            });
        });
    }

    async play(stop: boolean): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try {
            if (!stop) {
                const armed = this.logpoints.points().length > 0;
                if (armed) await this.logpoints.arm();
                // Plant the client log agent so the play-test client streams its
                // own output. Best-effort — a project with no client container
                // still plays, just without client-side output.
                await clientAgentInstall().catch(() => {});
                if (armed) await new Promise((r) => setTimeout(r, SYNC_SETTLE_MS));
            }
            await studioPlay(stop);
            if (stop) {
                if (this.logpoints.armed()) await this.logpoints.disarm();
                await clientAgentRemove().catch(() => {});
            }
        } catch (e) {
            this.toasts.push('error', stop ? 'Stop failed' : 'Play failed', String(e));
        } finally {
            this.busy.set(false);
        }
    }
}
