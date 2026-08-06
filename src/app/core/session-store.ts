import { BaseDirectory, create, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const SESSIONS_FILE_NAME = 'sessions.json';

// Angular port of code-editor/session-store.ts, adapted to this port's flat
// tab list (no split-editor groups yet — see gap #3 in the port status notes).
export type Session = { files: string[]; active: string | null };
type SessionsFile = Record<string, Session>;

async function readAll(): Promise<SessionsFile> {
    try {
        const file = await readTextFile(SESSIONS_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
        return file ? JSON.parse(file) : {};
    } catch {
        const file = await create(SESSIONS_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
        await file.write(new TextEncoder().encode('{}'));
        await file.close();
        return {};
    }
}

/** Restore the last set of open tabs for a project, keyed by its path. */
export async function readSession(projectPath: string): Promise<Session | null> {
    try {
        const all = await readAll();
        return all[projectPath] ?? null;
    } catch (e) {
        console.error('[session] read failed', e);
        return null;
    }
}

/** Persist the current tabs for a project, so reopening it restores them. */
export async function writeSession(projectPath: string, session: Session): Promise<void> {
    try {
        const all = await readAll();
        all[projectPath] = session;
        await writeTextFile(SESSIONS_FILE_NAME, JSON.stringify(all, null, 2), {
            baseDir: BaseDirectory.AppLocalData,
        });
    } catch (e) {
        console.error('[session] write failed', e);
    }
}
