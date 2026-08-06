import { BaseDirectory, create, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const SETTINGS_FILE_NAME = 'settings.json';

export type SettingsValues = Record<string, unknown>;

export const readSettings = async (): Promise<SettingsValues> => {
    try {
        const file = await readTextFile(SETTINGS_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
        return file ? JSON.parse(file) : {};
    } catch {
        const file = await create(SETTINGS_FILE_NAME, { baseDir: BaseDirectory.AppLocalData });
        await file.write(new TextEncoder().encode('{}'));
        await file.close();
        return {};
    }
};

type SettingsListener = (values: SettingsValues) => void;
const listeners = new Set<SettingsListener>();

/** Subscribe to settings changes. Returns an unsubscribe function. */
export const subscribeSettings = (listener: SettingsListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const writeSettings = async (values: SettingsValues): Promise<void> => {
    await writeTextFile(SETTINGS_FILE_NAME, JSON.stringify(values, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
    });
    for (const listener of listeners) listener(values);
};
