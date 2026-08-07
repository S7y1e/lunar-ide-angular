import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile, writeTextFile, rename, mkdir } from '@tauri-apps/plugin-fs';
import { moveEdits } from '../core/project-queries';
import { baseName, toRelative } from '../core/path';
import type { RenameEdit } from './rename-module';
import { getCurrentLspClient } from '../code-editor/luau-lsp/lsp-registry';

export type MovePlan = {
    oldRel: string;
    newRel: string; // the module file's new location (.luau)
    srcRel: string; // what moves on disk (file, or the init folder)
    dstRel: string; // its destination path on disk
    edits: RenameEdit[];
};

const isInit = (base: string) => /^init\.(server\.|client\.)?lua(u)?$/.test(base);

// Resolve where the module's file lands and what actually moves on disk. For an
// init module the whole containing folder moves.
function plan(oldRel: string, destDir: string): Omit<MovePlan, 'edits'> {
    const dir = destDir.replace(/\\/g, '/').replace(/\/+$/, '');
    const base = baseName(oldRel);
    if (isInit(base)) {
        const parts = oldRel.split('/');
        const folder = parts[parts.length - 2];
        const srcRel = parts.slice(0, -1).join('/');
        const dstRel = dir ? `${dir}/${folder}` : folder;
        return { oldRel, newRel: `${dstRel}/${base}`, srcRel, dstRel };
    }
    const newRel = dir ? `${dir}/${base}` : base;
    return { oldRel, newRel, srcRel: oldRel, dstRel: newRel };
}

// Build (don't apply) the move plan: precise dependent edits over the owned model.
export async function buildMovePlan(root: string, activeAbs: string, destDir: string): Promise<MovePlan | null> {
    const oldRel = toRelative(root, activeAbs);
    if (!/\.(lua|luau)$/.test(oldRel)) return null;
    const p = plan(oldRel, destDir);
    if (p.newRel === oldRel) return { ...p, edits: [] };
    const edits = await moveEdits(oldRel, p.newRel);
    return { ...p, edits };
}

// Apply the plan: rewrite each dependent line (only if it still matches the
// preview), then move the file/folder on disk. Returns the new module abs path.
export async function applyMovePlan(root: string, p: MovePlan): Promise<string> {
    const byFile = new Map<string, RenameEdit[]>();
    for (const edit of p.edits) {
        const list = byFile.get(edit.file) ?? [];
        list.push(edit);
        byFile.set(edit.file, list);
    }

    for (const [file, fileEdits] of byFile) {
        const abs = await join(root, ...file.split('/'));
        const text = await readTextFile(abs);
        const eol = text.includes('\r\n') ? '\r\n' : '\n';
        const lines = text.split(/\r?\n/);
        for (const edit of fileEdits) {
            if (lines[edit.line - 1] === edit.before) {
                lines[edit.line - 1] = edit.after;
            }
        }
        await writeTextFile(abs, lines.join(eol));
    }

    const parent = p.dstRel.split('/').slice(0, -1);
    if (parent.length) {
        await mkdir(await join(root, ...parent), { recursive: true }).catch(() => {});
    }
    const srcAbs = await join(root, ...p.srcRel.split('/'));
    const dstAbs = await join(root, ...p.dstRel.split('/'));
    await rename(srcAbs, dstAbs);

    await invoke('project_write_sourcemap').catch(() => {});
    getCurrentLspClient()?.revalidate();

    return join(root, ...p.newRel.split('/'));
}
