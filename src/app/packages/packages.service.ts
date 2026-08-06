import { Injectable, effect, inject, signal } from '@angular/core';
import { ProjectService } from '../core/project.service';
import { PackageList, ShellRun, projectPackages, wallyInstall, wallyUpdate } from '../core/packages';

@Injectable({ providedIn: 'root' })
export class PackagesService {
    private readonly project = inject(ProjectService);

    readonly list = signal<PackageList | null>(null);
    readonly busy = signal(false);
    readonly log = signal<string | null>(null);

    constructor() {
        effect(() => {
            if (this.project.root()) this.refresh();
        });
    }

    refresh(): void {
        projectPackages()
            .then((l) => this.list.set(l))
            .catch(() => {});
    }

    private async run(fn: () => Promise<ShellRun>): Promise<void> {
        this.busy.set(true);
        this.log.set(null);
        try {
            const r = await fn();
            this.log.set(r.output.trim() || (r.code === 0 ? 'Done.' : `Exited ${r.code}`));
            this.refresh();
        } catch (e) {
            this.log.set(String(e));
        } finally {
            this.busy.set(false);
        }
    }

    install(): Promise<void> {
        return this.run(wallyInstall);
    }
    update(): Promise<void> {
        return this.run(wallyUpdate);
    }
}
