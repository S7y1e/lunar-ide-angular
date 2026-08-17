import { Injectable, signal } from '@angular/core';
import { createProjectResource } from '../core/project-resource';
import { PackageList, ShellRun, projectPackages, wallyInstall, wallyUpdate } from '../core/packages';

@Injectable({ providedIn: 'root' })
export class PackagesService {
    // Only the manifests matter; the filter keeps writes inside Packages/ from
    // triggering a re-read on every installed file.
    private readonly resource = createProjectResource<PackageList | null>(projectPackages, null, {
        match: (path) => /(wally\.toml|wally\.lock)$/.test(path),
        delayMs: 400,
    });

    readonly list = this.resource.data;
    readonly busy = signal(false);
    readonly log = signal<string | null>(null);

    refresh(): void {
        this.resource.refresh();
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
