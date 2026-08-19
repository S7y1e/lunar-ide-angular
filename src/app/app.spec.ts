import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

// Mounting App builds the whole service tree, and those services call into
// Tauri from their constructors, so every module the tree touches has to be
// stubbed before the import below. Same approach the focused specs take.
vi.mock('@tauri-apps/api/core', () => ({ invoke: () => Promise.resolve(null) }));
vi.mock('@tauri-apps/api/event', () => ({
    listen: () => Promise.resolve(() => {}),
    emit: () => Promise.resolve(),
}));
vi.mock('@tauri-apps/api/path', () => ({
    join: (...parts: string[]) => Promise.resolve(parts.join('/')),
    dirname: (p: string) => Promise.resolve(p),
    appDataDir: () => Promise.resolve('/app-data'),
    resolveResource: (p: string) => Promise.resolve(`/resources/${p}`),
}));
vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: () => ({
        onCloseRequested: () => Promise.resolve(() => {}),
        listen: () => Promise.resolve(() => {}),
    }),
}));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: () => Promise.resolve('5.0.0') }));
vi.mock('@tauri-apps/plugin-fs', () => ({
    // Callers pass these as baseDir; only the identity matters under test.
    BaseDirectory: { AppData: 1, AppConfig: 2, AppLocalData: 3, Home: 4, Temp: 5 },
    watch: () => Promise.resolve(() => {}),
    // Settings and the recent-projects list open their file through create().
    create: () =>
        Promise.resolve({
            write: () => Promise.resolve(0),
            close: () => Promise.resolve(),
        }),
    readTextFile: () => Promise.resolve(''),
    writeTextFile: () => Promise.resolve(),
    readDir: () => Promise.resolve([]),
    exists: () => Promise.resolve(false),
    mkdir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    rename: () => Promise.resolve(),
}));
vi.mock('@tauri-apps/plugin-shell', () => ({
    Command: class {
        static create() {
            return new this();
        }
        spawn() {
            return Promise.resolve({ pid: 1 });
        }
        execute() {
            return Promise.resolve({ code: 0, stdout: '', stderr: '' });
        }
    },
    open: () => Promise.resolve(),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: () => Promise.resolve(null),
    save: () => Promise.resolve(null),
    message: () => Promise.resolve(),
    confirm: () => Promise.resolve(false),
}));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: () => Promise.resolve(new Response('')) }));

import { App } from './app';
import { ProjectService } from './core/project.service';

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

describe('App', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [App],
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(App);
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('shows the home screen until a project is open', async () => {
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('app-dock-stripe')).toBeNull();
        expect(compiled.querySelector('app-home')).toBeTruthy();
    });

    it('renders the dock stripes once a project is open', async () => {
        const fixture = TestBed.createComponent(App);
        TestBed.inject(ProjectService).snapshot.set(snapshotFor('/proj'));
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('app-dock-stripe')).toBeTruthy();
    });
});
