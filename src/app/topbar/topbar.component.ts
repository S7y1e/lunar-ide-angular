import { Component, inject, signal } from '@angular/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ProjectService } from '../core/project.service';
import {
    RecentProject,
    getRecentProjectsFile,
    selectFolder,
} from '../core/recent-projects';

// Consolidated port of components/topbar (index/file-menu/window-controls
// were 3 files in React; small enough here to stay one).
@Component({
    selector: 'app-topbar',
    standalone: true,
    templateUrl: './topbar.component.html',
    styleUrl: './topbar.component.scss',
})
export class TopBarComponent {
    protected readonly project = inject(ProjectService);
    protected readonly fileOpen = signal(false);
    protected readonly recent = signal<RecentProject[]>([]);

    protected loadRecent(): void {
        getRecentProjectsFile().then((p) => this.recent.set(p));
    }

    protected async openFolder(): Promise<void> {
        this.fileOpen.set(false);
        const path = await selectFolder();
        if (path) await this.project.open(path);
    }

    protected async openRecent(path: string): Promise<void> {
        this.fileOpen.set(false);
        await this.project.open(path);
    }

    protected async closeProject(): Promise<void> {
        this.fileOpen.set(false);
        await this.project.close();
    }

    protected minimize(): void {
        getCurrentWindow().minimize();
    }
    protected maximize(): void {
        getCurrentWindow().toggleMaximize();
    }
    protected closeWindow(): void {
        getCurrentWindow().close();
    }
}
