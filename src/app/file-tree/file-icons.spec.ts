import { fileIconFor, resolveFileIcon } from './file-icons';

const node = (name: string, isDir: boolean) => ({ name, path: `/p/${name}`, isDir });

describe('file icons', () => {
    it('matches the longest known suffix, not the first dot', () => {
        // "init.client.luau" must be luau, not a miss on the "client.luau" pass.
        expect(fileIconFor('init.client.luau')).toBe('icons/charmed/luau.svg');
        expect(fileIconFor('default.project.json')).toBe('icons/charmed/json.svg');
    });

    it('prefers an exact filename over the extension', () => {
        expect(fileIconFor('.gitignore')).toBe('icons/charmed/git.svg');
        expect(fileIconFor('LICENSE.md')).toBe('icons/charmed/license.svg');
        // …while a plain .md still gets the markdown icon.
        expect(fileIconFor('README.md')).toBe('icons/charmed/markdown.svg');
    });

    it('falls back to the generic file icon for unknown types', () => {
        expect(fileIconFor('weird.qqq')).toBe('icons/charmed/_file.svg');
        expect(fileIconFor('noextension')).toBe('icons/charmed/_file.svg');
    });

    it('swaps folder icons on expand', () => {
        expect(resolveFileIcon(node('src', true), false)).toBe('icons/charmed/folder_source.svg');
        expect(resolveFileIcon(node('src', true), true)).toBe('icons/charmed/folder_source_open.svg');
    });

    it('uses the generic folder icon for unnamed/unknown folders', () => {
        expect(resolveFileIcon(node('whatever', true), false)).toBe('icons/charmed/_folder.svg');
        expect(resolveFileIcon(node('whatever', true), true)).toBe('icons/charmed/_folder_open.svg');
    });

    it('is case-insensitive on both folder and file names', () => {
        expect(resolveFileIcon(node('SRC', true), false)).toBe('icons/charmed/folder_source.svg');
        expect(fileIconFor('Main.LUAU')).toBe('icons/charmed/luau.svg');
    });
});
