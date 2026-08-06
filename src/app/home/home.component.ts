import { Component, OnInit, inject, signal } from '@angular/core';
import { exists } from '@tauri-apps/plugin-fs';
import { ProjectService } from '../core/project.service';
import {
    RecentProject,
    getRecentProjectsFile,
    removeRecentProjectFromList,
    selectFolder,
    updateRecentProjects,
} from '../core/recent-projects';
import { createProject, NewProjectOptions } from '../core/new-project';
import { NewProjectDialogComponent } from './new-project-dialog.component';

// Port of apps/home — welcome screen, recent projects, and the new-project
// scaffolding wizard.
@Component({
    selector: 'app-home',
    standalone: true,
    imports: [NewProjectDialogComponent],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
    private readonly project = inject(ProjectService);
    protected readonly projects = signal<RecentProject[]>([]);
    protected readonly showNewProject = signal(false);

    ngOnInit(): void {
        this.loadProjects();
    }

    private loadProjects(): void {
        getRecentProjectsFile().then((p) => this.projects.set(p));
    }

    protected async openFolder(): Promise<void> {
        const path = await selectFolder();
        if (path) {
            this.loadProjects();
            await this.project.open(path);
        }
    }

    protected async newProject(options: NewProjectOptions): Promise<void> {
        this.showNewProject.set(false);
        const path = await createProject(options);
        if (path) {
            await updateRecentProjects(path);
            this.loadProjects();
            await this.project.open(path);
        }
    }

    // Opening from the recent list: the folder may have been deleted or moved
    // since it was saved, so verify it still exists before switching screens.
    protected async openRecent(path: string): Promise<void> {
        if (!(await exists(path))) {
            await removeRecentProjectFromList(path);
            this.loadProjects();
            return;
        }
        await this.project.open(path);
    }

    protected async remove(e: Event, path: string): Promise<void> {
        e.stopPropagation();
        await removeRecentProjectFromList(path);
        this.loadProjects();
    }
}
