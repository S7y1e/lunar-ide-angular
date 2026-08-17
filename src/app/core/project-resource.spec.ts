import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

const fs = vi.hoisted(() => ({
    registrations: [] as { path: string; cb: (e: { paths: string[] }) => void; options: any }[],
    unwatched: [] as string[],
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
    watch: (path: string, cb: (e: { paths: string[] }) => void, options: any) => {
        fs.registrations.push({ path, cb, options });
        return Promise.resolve(() => fs.unwatched.push(path));
    },
    readTextFile: () => Promise.resolve(''),
    writeTextFile: () => Promise.resolve(),
    readDir: () => Promise.resolve([]),
    mkdir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    rename: () => Promise.resolve(),
}));

vi.mock('@tauri-apps/api/path', () => ({
    join: (...parts: string[]) => Promise.resolve(parts.join('/')),
    dirname: (p: string) => Promise.resolve(p),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: () => Promise.resolve(null) }));

import { LUAU_SOURCE, SOURCE_OR_SOURCEMAP, createProjectResource } from './project-resource';
import { ProjectWatcherService } from './project-watcher.service';
import { ProjectService } from './project.service';
import { isRelevant } from '../data-model/data-model.service';

const ROOT = '/proj';

const snapshotFor = (root: string) => ({
    root,
    name: 'p',
    projectFile: 'default.project.json',
    syncBackend: null,
    testCommand: null,
    testEz: null,
    testRoots: [],
    buildOutput: null,
});

const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    TestBed.tick();
};

describe('ProjectWatcherService', () => {
    let project: ProjectService;

    beforeEach(() => {
        fs.registrations = [];
        fs.unwatched = [];
        TestBed.configureTestingModule({});
        project = TestBed.inject(ProjectService);
        TestBed.inject(ProjectWatcherService);
        TestBed.tick();
    });

    const open = async (root = ROOT) => {
        project.snapshot.set(snapshotFor(root));
        await settle();
    };

    const fire = (paths: string[]) => fs.registrations.at(-1)!.cb({ paths });

    it('opens exactly one recursive watch for the project root', async () => {
        await open();
        expect(fs.registrations).toHaveLength(1);
        expect(fs.registrations[0].path).toBe(ROOT);
        expect(fs.registrations[0].options).toMatchObject({ recursive: true });
    });

    it('re-targets on project switch instead of stacking watchers', async () => {
        await open();
        await open('/other');
        expect(fs.unwatched).toEqual([ROOT]);
        expect(fs.registrations.map((r) => r.path)).toEqual([ROOT, '/other']);
    });

    it('drops churn from ignored directories before fan-out', async () => {
        await open();
        const watcher = TestBed.inject(ProjectWatcherService);
        const hits: string[][] = [];
        watcher.subscribe(() => true, 0, (paths) => hits.push(paths));

        vi.useFakeTimers();
        fire(['/proj/.git/index', '/proj/node_modules/x/a.luau', '/proj/target/debug/y']);
        vi.runAllTimers();
        vi.useRealTimers();

        // Nothing survived the ignore list, so no subscriber ran at all — this is
        // what keeps a git operation from waking every panel.
        expect(hits).toEqual([]);
    });

    it('only wakes subscribers whose filter matches', async () => {
        await open();
        const watcher = TestBed.inject(ProjectWatcherService);
        const luau: string[][] = [];
        const wally: string[][] = [];
        watcher.subscribe(LUAU_SOURCE, 0, (p) => luau.push(p));
        watcher.subscribe((p) => p.endsWith('wally.toml'), 0, (p) => wally.push(p));

        vi.useFakeTimers();
        fire(['/proj/src/main.luau']);
        vi.runAllTimers();
        vi.useRealTimers();

        expect(luau).toEqual([['/proj/src/main.luau']]);
        expect(wally).toEqual([]);
    });

    it('coalesces a burst into one call per subscriber, keeping its own delay', async () => {
        await open();
        const watcher = TestBed.inject(ProjectWatcherService);
        const calls: string[][] = [];
        watcher.subscribe(LUAU_SOURCE, 400, (p) => calls.push(p));

        vi.useFakeTimers();
        fire(['/proj/a.luau']);
        vi.advanceTimersByTime(100);
        fire(['/proj/b.luau']);
        vi.advanceTimersByTime(100);
        expect(calls).toEqual([]); // still inside the debounce window
        vi.advanceTimersByTime(400);
        vi.useRealTimers();

        expect(calls).toHaveLength(1);
        expect(calls[0].sort()).toEqual(['/proj/a.luau', '/proj/b.luau']);
    });

    it('stops delivering to a subscriber after it unsubscribes', async () => {
        await open();
        const watcher = TestBed.inject(ProjectWatcherService);
        const calls: string[][] = [];
        const off = watcher.subscribe(LUAU_SOURCE, 0, (p) => calls.push(p));
        off();

        vi.useFakeTimers();
        fire(['/proj/a.luau']);
        vi.runAllTimers();
        vi.useRealTimers();

        expect(calls).toEqual([]);
    });
});

describe('createProjectResource', () => {
    let project: ProjectService;
    let fetches: number;

    const build = (watchConfig?: Parameters<typeof createProjectResource>[2]) =>
        TestBed.runInInjectionContext(() =>
            createProjectResource(
                () => {
                    fetches++;
                    return Promise.resolve(null);
                },
                null,
                watchConfig,
            ),
        );

    beforeEach(() => {
        fs.registrations = [];
        fs.unwatched = [];
        fetches = 0;
        TestBed.configureTestingModule({});
        project = TestBed.inject(ProjectService);
    });

    const open = async () => {
        project.snapshot.set(snapshotFor(ROOT));
        await settle();
    };

    const fire = (paths: string[]) => fs.registrations.at(-1)!.cb({ paths });

    it('several resources share the single project watcher', async () => {
        build({ match: LUAU_SOURCE, delayMs: 0 });
        build({ match: SOURCE_OR_SOURCEMAP, delayMs: 0 });
        build({ match: LUAU_SOURCE, delayMs: 0 });
        await open();

        // The whole point of the consolidation: three resources, one inotify
        // watch — not three.
        expect(fs.registrations).toHaveLength(1);
    });

    it('refreshes on a matching path and ignores the rest', async () => {
        build({ match: LUAU_SOURCE, delayMs: 0 });
        await open();
        expect(fetches).toBe(1); // initial load

        vi.useFakeTimers();
        fire(['/proj/src/main.luau']);
        vi.runAllTimers();
        vi.useRealTimers();
        await settle();
        expect(fetches).toBe(2);

        vi.useFakeTimers();
        fire(['/proj/README.md']);
        vi.runAllTimers();
        vi.useRealTimers();
        await settle();
        expect(fetches).toBe(2);
    });

    it('does not subscribe when no watch config is given', async () => {
        build();
        await open();
        expect(fetches).toBe(1);

        vi.useFakeTimers();
        fire(['/proj/src/main.luau']);
        vi.runAllTimers();
        vi.useRealTimers();
        await settle();
        expect(fetches).toBe(1);
    });
});

// The DataModel is the one resource that *writes* sourcemap.json, so reacting
// to it would be a self-sustaining refresh loop.
describe('DataModel watch filter', () => {
    it('ignores sourcemap.json on both path separators', () => {
        expect(isRelevant('/proj/sourcemap.json')).toBe(false);
        expect(isRelevant('C:\\proj\\sourcemap.json')).toBe(false);
    });

    it('still reacts to other project files', () => {
        expect(isRelevant('/proj/src/main.luau')).toBe(true);
        expect(isRelevant('/proj/default.project.json')).toBe(true);
        expect(isRelevant('/proj/wally.toml')).toBe(true);
        expect(isRelevant('/proj/README.md')).toBe(false);
    });
});
