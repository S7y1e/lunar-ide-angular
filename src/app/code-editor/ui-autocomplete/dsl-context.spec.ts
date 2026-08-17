import { detectDslContext } from './dsl-context';

// `|` marks the cursor. Keeps the fixtures readable, since every case is about
// where the caret sits.
const at = (srcWithCaret: string) => {
    const offset = srcWithCaret.indexOf('|');
    if (offset < 0) throw new Error('fixture needs a | caret');
    return detectDslContext(srcWithCaret.replace('|', ''), offset);
};

describe('detectDslContext', () => {
    it('returns null outside any element', () => {
        expect(at('local x = 1\nprint(|)')).toBeNull();
        expect(at('local t = { foo = |1 }')).toBeNull();
    });

    describe('class-name position', () => {
        it('detects the curried Fusion form mid-string', () => {
            expect(at('New "Text|')).toEqual({ kind: 'class', library: 'fusion' });
        });

        it('detects the call form', () => {
            expect(at('New("Text|')).toEqual({ kind: 'class', library: 'fusion' });
        });

        it('maps each factory to its library', () => {
            expect(at('create "Fra|')).toEqual({ kind: 'class', library: 'vide' });
            expect(at('createElement("Fra|')).toEqual({ kind: 'class', library: 'react' });
            expect(at('e("Fra|')).toEqual({ kind: 'class', library: 'react' });
        });
    });

    describe('props table', () => {
        it('resolves the class from the curried form', () => {
            expect(at('New "TextLabel" { | }')).toMatchObject({
                kind: 'key',
                className: 'TextLabel',
                library: 'fusion',
            });
        });

        it('resolves the parenthesised curried forms', () => {
            expect(at('New "TextLabel" ({ | })')).toMatchObject({
                kind: 'key',
                className: 'TextLabel',
            });
            expect(at('New("TextLabel")({ | })')).toMatchObject({
                kind: 'key',
                className: 'TextLabel',
            });
        });

        it("resolves React's comma form, where the class is the first call argument", () => {
            expect(at('createElement("Frame", { | })')).toMatchObject({
                kind: 'key',
                className: 'Frame',
                library: 'react',
            });
        });

        it('switches to value context after the = of an entry', () => {
            expect(at('New "TextLabel" { TextXAlignment = | }')).toMatchObject({
                kind: 'value',
                className: 'TextLabel',
                propName: 'TextXAlignment',
            });
        });

        it('goes back to key context after a separator', () => {
            expect(at('New "TextLabel" { Text = "hi", | }')).toMatchObject({
                kind: 'key',
                className: 'TextLabel',
            });
        });

        it('uses the innermost table, so a nested element wins', () => {
            expect(at('New "Frame" { [Children] = New "TextLabel" { | } }')).toMatchObject({
                kind: 'key',
                className: 'TextLabel',
            });
        });
    });

    describe('file-local factory aliases', () => {
        it('follows `local new = Fusion.New`', () => {
            const src = 'local new = Fusion.New\nreturn new "Frame" { | }';
            expect(at(src)).toMatchObject({ kind: 'key', className: 'Frame', library: 'fusion' });
        });

        it('follows a scope-style alias with a colon', () => {
            const src = 'local mk = scope:create\nreturn mk "Frame" { | }';
            expect(at(src)).toMatchObject({ kind: 'key', className: 'Frame', library: 'vide' });
        });
    });

    describe('Fusion Hydrate', () => {
        it('reads the class off an inline cast', () => {
            expect(at('Fusion:Hydrate(inst :: TextLabel)({ | })')).toMatchObject({
                kind: 'key',
                className: 'TextLabel',
                library: 'fusion',
            });
        });

        it('reads the class off a local annotation elsewhere in the file', () => {
            const src = 'local label: TextButton = nil\nFusion:Hydrate(label) { | }';
            expect(at(src)).toMatchObject({ kind: 'key', className: 'TextButton' });
        });

        it('falls back to the GUI union when the target is untyped', () => {
            const ctx = at('Fusion:Hydrate(mystery)({ | })');
            expect(ctx).toMatchObject({ kind: 'key', gui: true, library: 'fusion' });
            expect((ctx as any).className).toBeUndefined();
        });
    });

    describe('lexing hazards', () => {
        it('ignores an element mentioned inside a line comment', () => {
            expect(at('-- New "Frame" {\nlocal x = |1')).toBeNull();
        });

        it('ignores a block comment', () => {
            expect(at('--[[ New "Frame" { ]]\nlocal x = |1')).toBeNull();
        });

        it('does not treat a brace inside a string as a table', () => {
            expect(at('local s = "New \\"Frame\\" {"\nlocal y = |1')).toBeNull();
        });

        it('handles long-bracket strings', () => {
            expect(at('local s = [[ { ]]\nNew "Frame" { | }')).toMatchObject({
                kind: 'key',
                className: 'Frame',
            });
        });
    });
});
