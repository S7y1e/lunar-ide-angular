import { invoke } from '@tauri-apps/api/core';

export type GitFile = { path: string; index: string; work: string };
export type GitStatus = {
    branch: string;
    upstream: string | null;
    ahead: number;
    behind: number;
    files: GitFile[];
};
export type GitCommit = {
    hash: string;
    short: string;
    parents: string[];
    refs: string[];
    author: string;
    time: number;
    subject: string;
};

export const gitIsRepo = (): Promise<boolean> => invoke('git_is_repo');
export const gitStatus = (): Promise<GitStatus> => invoke('git_status');
export const gitLog = (limit?: number): Promise<GitCommit[]> => invoke('git_log', { limit });
export const gitStage = (path: string): Promise<void> => invoke('git_stage', { path });
export const gitUnstage = (path: string): Promise<void> => invoke('git_unstage', { path });
export const gitStageAll = (): Promise<void> => invoke('git_stage_all');
export const gitDiscard = (path: string): Promise<void> => invoke('git_discard', { path });
export const gitCommit = (message: string): Promise<string> => invoke('git_commit', { message });

// A file is staged if its index code is anything other than space/untracked.
export const isStaged = (f: GitFile): boolean => f.index !== ' ' && f.index !== '?';
export const isUntracked = (f: GitFile): boolean => f.index === '?';
