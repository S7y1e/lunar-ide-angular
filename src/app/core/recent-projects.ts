import { open } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, create, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { basename } from '@tauri-apps/api/path';

export type RecentProject = { name: string; path: string };

const RECENT_PROJECTS_FILE_NAME = 'recent_projects.json';
const MAX_RECENT_PROJECTS = 3;

const saveRecentProjects = (projects: RecentProject[]): Promise<void> =>
    writeTextFile(RECENT_PROJECTS_FILE_NAME, JSON.stringify(projects), {
        baseDir: BaseDirectory.AppLocalData,
    });

export async function getRecentProjectsFile(): Promise<RecentProject[]> {
    try {
        const file = await readTextFile(RECENT_PROJECTS_FILE_NAME, {
            baseDir: BaseDirectory.AppLocalData,
        });
        return file ? JSON.parse(file) : [];
    } catch {
        const file = await create(RECENT_PROJECTS_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
        await file.write(new TextEncoder().encode('[]'));
        await file.close();
        return [];
    }
}

export async function updateRecentProjects(path: string): Promise<void> {
    const recent = (await getRecentProjectsFile()).filter((p) => p.path !== path);
    const name = await basename(path);
    recent.unshift({ name, path });
    await saveRecentProjects(recent.slice(0, MAX_RECENT_PROJECTS));
}

export async function removeRecentProjectFromList(path: string): Promise<void> {
    const recent = (await getRecentProjectsFile()).filter((p) => p.path !== path);
    await saveRecentProjects(recent);
}

// Opens the native folder picker and records the pick in the recent list.
export async function selectFolder(): Promise<string | null> {
    const path = await open({ multiple: false, directory: true });
    if (!path) return null;
    await updateRecentProjects(path);
    return path;
}
