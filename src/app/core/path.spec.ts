import { baseName, pathSegments, toRelative } from './path';

describe('baseName', () => {
    it('takes the last segment of either separator', () => {
        expect(baseName('/proj/src/init.luau')).toBe('init.luau');
        expect(baseName('C:\\proj\\src\\init.luau')).toBe('init.luau');
    });

    it('falls back to the input when there is no separator', () => {
        expect(baseName('init.luau')).toBe('init.luau');
    });

    it('returns the input for a trailing separator rather than an empty name', () => {
        expect(baseName('/proj/src/')).toBe('/proj/src/');
    });
});

describe('pathSegments', () => {
    it('splits on either separator and drops the empties', () => {
        expect(pathSegments('/proj/src/init.luau')).toEqual(['proj', 'src', 'init.luau']);
        expect(pathSegments('C:\\proj\\src')).toEqual(['C:', 'proj', 'src']);
        expect(pathSegments('//proj//src//')).toEqual(['proj', 'src']);
    });
});

describe('toRelative', () => {
    it('strips the root and normalises to forward slashes', () => {
        expect(toRelative('/proj', '/proj/src/init.luau')).toBe('src/init.luau');
        expect(toRelative('C:\\proj', 'C:\\proj\\src\\init.luau')).toBe('src/init.luau');
    });

    it('handles a root that already ends in a separator', () => {
        expect(toRelative('/proj/', '/proj/src/init.luau')).toBe('src/init.luau');
    });

    it('leaves a path outside the root alone', () => {
        expect(toRelative('/proj', '/elsewhere/init.luau')).toBe('elsewhere/init.luau');
    });

    // A sibling directory whose name merely starts with the root's name is not
    // inside the root. Slicing by length alone would report "assets/init.luau",
    // a relative path that looks valid and resolves to the wrong file.
    it('does not treat a sibling sharing the root prefix as inside the root', () => {
        expect(toRelative('/home/u/game', '/home/u/game-assets/init.luau')).toBe(
            'home/u/game-assets/init.luau',
        );
    });

    it('maps the root itself to an empty path', () => {
        expect(toRelative('/proj', '/proj')).toBe('');
    });
});
