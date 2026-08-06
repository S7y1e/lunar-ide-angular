import { invoke } from '@tauri-apps/api/core';

export type PackageKind = 'shared' | 'server' | 'dev';

export type Package = {
    alias: string;
    name: string;
    versionReq: string;
    locked: string | null;
    kind: PackageKind;
};

export type PackageList = { hasWally: boolean; locked: boolean; packages: Package[] };
export type ShellRun = { code: number; output: string };

export const projectPackages = (): Promise<PackageList> => invoke('project_packages');
export const packageAdd = (spec: string, kind: PackageKind): Promise<void> =>
    invoke('package_add', { spec, kind });
export const packageRemove = (alias: string, kind: PackageKind): Promise<void> =>
    invoke('package_remove', { alias, kind });
export const wallyInstall = (): Promise<ShellRun> => invoke('wally_install');
export const wallyUpdate = (): Promise<ShellRun> => invoke('wally_update');
