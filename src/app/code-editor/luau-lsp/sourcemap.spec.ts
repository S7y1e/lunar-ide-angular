import { affectsSourcemap } from './sourcemap.service';

// This filter decides when sourcemap.json gets rewritten. It has to catch
// everything the Rust generator reads — otherwise a file created after the last
// write has no instance path and every `require(script.Parent.X)` inside it
// reports "Unknown require: unsupported path" — while never matching
// sourcemap.json itself, which is the only thing standing between the write and
// an endless write → watcher → write loop.
describe('affectsSourcemap', () => {
    it('never matches the file it triggers the write of', () => {
        expect(affectsSourcemap('/proj/sourcemap.json')).toBe(false);
        expect(affectsSourcemap('C:\\proj\\sourcemap.json')).toBe(false);
    });

    it('matches the sources the generator maps into the tree', () => {
        expect(affectsSourcemap('/proj/src/main.luau')).toBe(true);
        expect(affectsSourcemap('/proj/src/legacy.lua')).toBe(true);
        expect(affectsSourcemap('C:\\proj\\src\\init.server.luau')).toBe(true);
    });

    // A nested default.project.json re-roots a whole subtree, so editing one
    // moves instances without any .luau file changing.
    it('matches project files, at the root and nested', () => {
        expect(affectsSourcemap('/proj/default.project.json')).toBe(true);
        expect(affectsSourcemap('/proj/src/Packages/dev.project.json')).toBe(true);
        expect(affectsSourcemap('C:\\proj\\default.project.json')).toBe(true);
    });

    it('ignores files the tree does not depend on', () => {
        expect(affectsSourcemap('/proj/README.md')).toBe(false);
        expect(affectsSourcemap('/proj/lunar.toml')).toBe(false);
        expect(affectsSourcemap('/proj/src/Thing.meta.json')).toBe(false);
    });
});
