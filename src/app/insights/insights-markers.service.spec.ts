import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

const mon = vi.hoisted(() => ({
    providers: [] as any[],
    marked: [] as { owner: string; markers: any[] }[],
    models: [] as any[],
}));

const backend = vi.hoisted(() => ({ insights: null as any }));

vi.mock('monaco-editor', () => ({
    editor: {
        getModels: () => mon.models,
        setModelMarkers: (_model: any, owner: string, markers: any[]) =>
            mon.marked.push({ owner, markers }),
        onDidCreateModel: () => ({ dispose(): void {} }),
        getModel: () => null,
    },
    languages: {
        registerCodeActionProvider: (_lang: string, p: any) => mon.providers.push(p),
    },
    MarkerSeverity: { Info: 2, Warning: 4, Error: 8 },
    Range: class {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number,
        ) {}
    },
    Uri: { parse: (s: string) => s },
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (cmd: string) =>
        cmd === 'project_insights' ? Promise.resolve(backend.insights) : Promise.resolve(null),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));
vi.mock('@tauri-apps/api/path', () => ({
    join: (...p: string[]) => Promise.resolve(p.join('/')),
    dirname: (p: string) => Promise.resolve(p),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
    watch: () => Promise.resolve(() => {}),
    readTextFile: () => Promise.resolve(''),
    writeTextFile: () => Promise.resolve(),
    readDir: () => Promise.resolve([]),
    exists: () => Promise.resolve(true),
    mkdir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    rename: () => Promise.resolve(),
    create: () => Promise.resolve(),
    BaseDirectory: { AppLocalData: 1 },
}));

import { InsightsMarkersService } from './insights-markers.service';
import { ProjectService } from '../core/project.service';
import { EditorGroupsService } from '../core/editor-groups.service';

const ROOT = '/proj';
const ABS = '/proj/src/main.luau';
const REL = 'src/main.luau';

const model = {
    uri: { toString: () => `file://${ABS}` },
    getVersionId: () => 7,
    onDidChangeContent: () => ({ dispose(): void {} }),
};

const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    TestBed.tick();
};

const finding = (category: string, line: number, severity = 'warning') => ({
    severity,
    category,
    message: `${category} at ${line}`,
    file: REL,
    line,
});

describe('InsightsMarkersService', () => {
    let project: ProjectService;
    let groups: EditorGroupsService;

    const boot = async (findings: any[]) => {
        backend.insights = { findings };
        TestBed.configureTestingModule({});
        project = TestBed.inject(ProjectService);
        groups = TestBed.inject(EditorGroupsService);
        TestBed.inject(InsightsMarkersService);
        TestBed.tick();

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
        groups.activeFile.set(ABS);
        await settle();
    };

    beforeEach(() => {
        mon.providers = [];
        mon.marked = [];
        mon.models = [model];
    });

    const lastMarkers = () => mon.marked.filter((m) => m.owner === 'lunar-insights').at(-1)!.markers;

    it('squiggles findings on the active file', async () => {
        await boot([finding('orphan', 12), finding('shadowed', 30, 'info')]);
        const markers = lastMarkers();
        expect(markers).toHaveLength(2);
        expect(markers[0]).toMatchObject({ startLineNumber: 12, severity: 4 });
        expect(markers[1]).toMatchObject({ startLineNumber: 30, severity: 2 });
    });

    it('leaves unused-require to luau-lsp instead of double-marking it', async () => {
        await boot([finding('unused-require', 3), finding('orphan', 9)]);
        const markers = lastMarkers();
        expect(markers.map((m: any) => m.startLineNumber)).toEqual([9]);
    });

    it('offers a lightbulb fix for unused-require that deletes the whole line', async () => {
        await boot([finding('unused-require', 3)]);
        const provider = mon.providers[0];
        const result = provider.provideCodeActions(model, { startLineNumber: 1, endLineNumber: 5 });

        expect(result.actions).toHaveLength(1);
        expect(result.actions[0].title).toBe('Remove unused require');
        expect(result.actions[0].kind).toBe('quickfix');

        const edit = result.actions[0].edit.edits[0];
        expect(edit.versionId).toBe(7);
        // line 3 col 1 → line 4 col 1, replaced with nothing: the line and its
        // newline go, leaving no blank gap behind.
        expect(edit.textEdit).toMatchObject({
            text: '',
            range: { startLineNumber: 3, startColumn: 1, endLineNumber: 4, endColumn: 1 },
        });
    });

    it('only offers fixes for findings inside the requested range', async () => {
        await boot([finding('unused-require', 40)]);
        const provider = mon.providers[0];
        const outside = provider.provideCodeActions(model, { startLineNumber: 1, endLineNumber: 5 });
        expect(outside.actions).toHaveLength(0);
    });

    it('offers no fix for categories that have none', async () => {
        // "orphan" is a delete-file fix — a whole-file action, not a line edit,
        // so it must not show up as an in-editor quick-fix.
        await boot([finding('orphan', 3)]);
        const provider = mon.providers[0];
        const result = provider.provideCodeActions(model, { startLineNumber: 1, endLineNumber: 5 });
        expect(result.actions).toHaveLength(0);
    });
});
