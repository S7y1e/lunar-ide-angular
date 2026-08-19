import { vi } from 'vitest';

const calls = vi.hoisted(() => [] as { cmd: string; args?: unknown }[]);
vi.mock('@tauri-apps/api/core', () => ({
    invoke: (cmd: string, args?: unknown) => {
        calls.push({ cmd, args });
        return Promise.resolve(null);
    },
}));

import { applyInsightFix, fixFor, type InsightFinding } from './project-queries';

// Only the pieces of this module that decide something are worth pinning; the
// rest are one-line invoke wrappers whose test would just restate them. What
// fixFor decides, though, is whether a file gets deleted.
describe('fixFor', () => {
    it('maps orphan to deleting the file', () => {
        expect(fixFor('orphan')).toEqual({ label: 'Delete file', kind: 'delete-file' });
    });

    it('maps unused-require to deleting only the line', () => {
        expect(fixFor('unused-require')).toEqual({
            label: 'Remove unused require',
            kind: 'delete-line',
        });
    });

    it('offers no fix for anything else, so nothing destructive is guessed at', () => {
        expect(fixFor('shadowed-name')).toBeNull();
        expect(fixFor('')).toBeNull();
        expect(fixFor('Orphan')).toBeNull();
    });
});

describe('applyInsightFix', () => {
    const finding = (category: string): InsightFinding => ({
        severity: 'warning',
        category,
        message: 'm',
        file: 'src/a.luau',
        line: 4,
    });

    beforeEach(() => {
        calls.length = 0;
    });

    it('sends the mapped kind along with the file and line', async () => {
        await applyInsightFix(finding('orphan'));
        expect(calls).toEqual([
            { cmd: 'project_fix', args: { kind: 'delete-file', file: 'src/a.luau', line: 4 } },
        ]);
    });

    it('does nothing at all for a category with no fix', async () => {
        await applyInsightFix(finding('shadowed-name'));
        expect(calls).toEqual([]);
    });
});
