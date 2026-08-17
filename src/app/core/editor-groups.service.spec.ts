import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

// Shared fake disk, reachable from the hoisted module mocks below.
const disk = vi.hoisted(() => ({
    files: new Map<string, string>(),
    watchers: new Map<string, (e: { paths: string[] }) => void>(),
    unreadable: new Set<string>(),
    writes: [] as { path: string; content: string }[],
    // When set, watch() stays pending until releaseWatchers() runs — this is the
    // window in which a tab can close and reopen.
    deferWatch: false,
    pendingWatch: [] as (() => void)[],
    unwatchCalls: [] as string[],
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
    readTextFile: (path: string) =>
        disk.unreadable.has(path)
            ? Promise.reject(new Error('sharing violation'))
            : Promise.resolve(disk.files.get(path) ?? ''),
    writeTextFile: (path: string, content: string) => {
        disk.writes.push({ path, content });
        disk.files.set(path, content);
        return Promise.resolve();
    },
    watch: (path: string, cb: (e: { paths: string[] }) => void) => {
        disk.watchers.set(path, cb);
        const unwatch = () => {
            disk.unwatchCalls.push(path);
            disk.watchers.delete(path);
        };
        if (!disk.deferWatch) return Promise.resolve(unwatch);
        return new Promise<() => void>((resolve) => disk.pendingWatch.push(() => resolve(unwatch)));
    },
    exists: () => Promise.resolve(true),
    readDir: () => Promise.resolve([]),
    mkdir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    rename: () => Promise.resolve(),
    create: () => Promise.resolve(),
    BaseDirectory: { AppLocalData: 1 },
}));

vi.mock('@tauri-apps/api/path', () => ({
    join: (...parts: string[]) => Promise.resolve(parts.join('/')),
    dirname: (p: string) => Promise.resolve(p.split('/').slice(0, -1).join('/')),
}));

vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: () => Promise.resolve(null) }));

// monaco is only used here to dispose models on close/rename; the real module
// cannot load under jsdom.
vi.mock('monaco-editor', () => ({
    editor: { getModel: () => null },
    Uri: { parse: (s: string) => s },
}));

// session-store is left real — it rides on the mocked fs above, where its
// sessions.json read fails and is swallowed, i.e. "no saved session".
import { EditorGroupsService } from './editor-groups.service';
import { ProjectService } from './project.service';

const FILE = '/proj/src/main.luau';

// Let the pending fs promise chain settle; the service reads/watches async.
const settle = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    TestBed.tick();
};

const ROOT = '/proj';

const openProject = async (project: ProjectService) => {
    project.snapshot.set({
        root: ROOT,
        name: 'p',
        projectFile: 'default.project.json',
        syncBackend: null,
        testCommand: null,
        testEz: null,
        testRoots: [],
        buildOutput: null,
    });
    await settle();
};

// Simulate something else (Argon, git checkout) rewriting the file. Events now
// arrive through the single project-root watcher and are debounced, so the
// timers have to be run for the editor to see them.
const externalWrite = async (path: string, content: string) => {
    disk.files.set(path, content);
    vi.useFakeTimers();
    disk.watchers.get(ROOT)?.({ paths: [path] });
    vi.runAllTimers();
    vi.useRealTimers();
    await settle();
};

describe('EditorGroupsService — external change detection', () => {
    let groups: EditorGroupsService;

    beforeEach(async () => {
        disk.files.clear();
        disk.watchers.clear();
        disk.unreadable.clear();
        disk.writes = [];
        disk.deferWatch = false;
        disk.pendingWatch = [];
        disk.unwatchCalls = [];
        disk.files.set(FILE, 'local a = 1\n');

        TestBed.configureTestingModule({});
        groups = TestBed.inject(EditorGroupsService);
        TestBed.tick();
        await openProject(TestBed.inject(ProjectService));
        groups.openFile(FILE);
        await settle();
    });

    it('loads the file and watches through the shared project watcher', () => {
        expect(groups.content()).toBe('local a = 1\n');
        // One watch on the root covers every open tab — no per-file watch.
        expect(disk.watchers.has(ROOT)).toBe(true);
        expect(disk.watchers.has(FILE)).toBe(false);
        expect(groups.externalChange()).toBe(false);
    });

    it('ignores disk changes to files that are not open', async () => {
        await externalWrite('/proj/src/untracked.luau', 'whatever\n');
        expect(groups.content()).toBe('local a = 1\n');
        expect(groups.externalChange()).toBe(false);
    });

    it('reloads silently when there are no unsaved edits', async () => {
        await externalWrite(FILE, 'local a = 2\n');
        expect(groups.content()).toBe('local a = 2\n');
        expect(groups.externalChange()).toBe(false);
    });

    it('prompts instead of clobbering when the buffer is dirty', async () => {
        groups.setContent('local a = 99\n');
        await externalWrite(FILE, 'local a = 2\n');

        expect(groups.externalChange()).toBe(true);
        // The whole point: the user's unsaved edit survives.
        expect(groups.content()).toBe('local a = 99\n');
    });

    it('reloadFromDisk takes the disk version and clears the prompt', async () => {
        groups.setContent('local a = 99\n');
        await externalWrite(FILE, 'local a = 2\n');

        groups.reloadFromDisk();
        expect(groups.content()).toBe('local a = 2\n');
        expect(groups.externalChange()).toBe(false);
        expect(groups.dirtyFiles().has(FILE)).toBe(false);
    });

    it('keepMine dismisses the prompt and keeps the buffer dirty', async () => {
        groups.setContent('local a = 99\n');
        await externalWrite(FILE, 'local a = 2\n');

        groups.keepMine();
        expect(groups.externalChange()).toBe(false);
        expect(groups.content()).toBe('local a = 99\n');
        expect(groups.dirtyFiles().has(FILE)).toBe(true);
    });

    it('does not prompt when our own save round-trips with CRLF', async () => {
        groups.setContent('local a = 2\n');
        await groups.save();
        // Argon rewrites the file it just received, normalizing EOLs.
        await externalWrite(FILE, 'local a = 2\r\n');

        expect(groups.externalChange()).toBe(false);
        expect(groups.dirtyFiles().has(FILE)).toBe(false);
    });

    it('normalizes CRLF out of the buffer so Monaco and luau-lsp agree', async () => {
        await externalWrite(FILE, 'local a = 1\r\nlocal b = 2\r\n');
        expect(groups.content()).toBe('local a = 1\nlocal b = 2\n');
    });

    it('watches background tabs, not just the active one', async () => {
        const other = '/proj/src/other.luau';
        disk.files.set(other, 'return {}\n');
        groups.openFile(other);
        await settle();
        groups.select(FILE); // make the first file active again
        await settle();

        groups.setContent('local a = 99\n'); // dirty the *active* file
        await externalWrite(other, 'return { changed = true }\n');

        // The background tab reloaded on its own without touching the active one.
        expect(groups.content()).toBe('local a = 99\n');
        groups.select(other);
        expect(groups.content()).toBe('return { changed = true }\n');
    });

    it('stops reacting to a file once its tab closes', async () => {
        groups.close(FILE);
        await settle();
        await externalWrite(FILE, 'local a = 42\n');
        expect(groups.externalChange()).toBe(false);
    });
});

describe('EditorGroupsService — unreadable files', () => {
    let groups: EditorGroupsService;

    beforeEach(async () => {
        disk.files.clear();
        disk.watchers.clear();
        disk.unreadable.clear();
        disk.writes = [];
        disk.deferWatch = false;
        disk.pendingWatch = [];
        disk.unwatchCalls = [];
        disk.files.set(FILE, 'important contents\n');
        disk.unreadable.add(FILE); // locked by the sync tool

        TestBed.configureTestingModule({});
        groups = TestBed.inject(EditorGroupsService);
        TestBed.tick();
        await openProject(TestBed.inject(ProjectService));
        groups.openFile(FILE);
        await settle();
    });

    it('refuses to save a file that never loaded, instead of wiping it', async () => {
        // The read failed, so the buffer is empty — saving it would truncate a
        // real file on disk to nothing.
        await groups.save();

        expect(disk.writes.filter((w) => w.path === FILE)).toEqual([]);
        expect(disk.files.get(FILE)).toBe('important contents\n');
        expect(groups.saveError()).toContain('not saving to avoid overwriting it');
    });
});
