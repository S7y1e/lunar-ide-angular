import { Injectable, computed, inject, signal } from '@angular/core';
import { ProjectFile, walkProjectFiles } from '../core/filesystem';
import { ProjectSymbol, SearchMatch, projectSymbols, searchProject } from '../core/project-queries';
import { ProjectService } from '../core/project.service';
import { LayoutService } from '../core/layout.service';
import { SettingsUiService } from '../settings/settings-ui.service';
import { Command } from './commands';
import { buildEditorCommands } from './editor-commands';
import { SyncService } from '../sync/sync.service';
import { BuildService } from '../build/build.service';
import { TestResultsService } from '../tests/test-results.service';
import { RuntimeBridgeService } from '../runtime/runtime-bridge.service';
import { ToastsService } from '../notifications/toasts.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { RefactorUiService } from '../refactor/refactor-ui.service';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';

export type Scope = 'all' | 'files' | 'symbols' | 'actions' | 'text';
export const SCOPES: Scope[] = ['all', 'files', 'symbols', 'actions', 'text'];

const MAX_RESULTS = 50;
const ALL_CAP = 8; // per-category cap in the merged "all" scope
const DOUBLE_TAP_MS = 400;

const scoreFile = (file: ProjectFile, q: string): number => {
    const name = file.name.toLowerCase();
    const rel = file.relativePath.toLowerCase();
    if (name.startsWith(q)) return 100;
    if (name.includes(q)) return 60;
    if (rel.includes(q)) return 30;
    return 0;
};

export type PaletteItem =
    | { kind: 'file'; file: ProjectFile }
    | { kind: 'command'; command: Command }
    | { kind: 'symbol'; symbol: ProjectSymbol }
    | { kind: 'text'; match: SearchMatch };

// Angular port of use-palette.ts + use-command-palette.ts combined: one
// service owns both "how to open the palette" (keybindings) and "what's in
// it" (search across files/symbols/actions/text).
@Injectable({ providedIn: 'root' })
export class PaletteService {
    private readonly project = inject(ProjectService);
    private readonly layout = inject(LayoutService);
    private readonly settingsUi = inject(SettingsUiService);
    private readonly sync = inject(SyncService);
    private readonly build = inject(BuildService);
    private readonly tests = inject(TestResultsService);
    private readonly runtimeBridge = inject(RuntimeBridgeService);
    private readonly toasts = inject(ToastsService);
    private readonly editorGroups = inject(EditorGroupsService);
    private readonly refactorUi = inject(RefactorUiService);
    private readonly navigation = inject(EditorNavigationService);

    readonly isOpen = signal(false);
    readonly query = signal('');
    readonly scope = signal<Scope>('all');
    readonly active = signal(0);

    private readonly files = signal<ProjectFile[]>([]);
    private readonly symbols = signal<ProjectSymbol[]>([]);
    private readonly texts = signal<SearchMatch[]>([]);
    private lastShift = 0;
    private symbolTimer: ReturnType<typeof setTimeout> | null = null;
    private textTimer: ReturnType<typeof setTimeout> | null = null;

    readonly commands = computed<Command[]>(() =>
        buildEditorCommands(
            this.layout,
            this.settingsUi,
            this.sync,
            this.build,
            this.tests,
            this.runtimeBridge,
            this.toasts,
            this,
            this.editorGroups,
            this.refactorUi,
            this.project,
            this.navigation,
        ),
    );

    private readonly trimmed = computed(() => this.query().trimStart());
    private readonly prefixScope = computed<Scope | null>(() => {
        const t = this.trimmed();
        if (t.startsWith('>')) return 'actions';
        if (t.startsWith('#')) return 'symbols';
        return null;
    });
    readonly effScope = computed(() => this.prefixScope() ?? this.scope());
    private readonly q = computed(() => {
        const prefix = this.prefixScope();
        return (prefix ? this.trimmed().slice(1) : this.query()).trim();
    });
    private readonly ql = computed(() => this.q().toLowerCase());

    private readonly fileItems = computed<PaletteItem[]>(() => {
        const ql = this.ql();
        const list = !ql
            ? this.files().slice(0, MAX_RESULTS)
            : this.files()
                  .map((file) => ({ file, s: scoreFile(file, ql) }))
                  .filter((x) => x.s > 0)
                  .sort((a, b) => b.s - a.s)
                  .slice(0, MAX_RESULTS)
                  .map((x) => x.file);
        return list.map((file) => ({ kind: 'file' as const, file }));
    });

    private readonly commandItems = computed<PaletteItem[]>(() => {
        const ql = this.ql();
        return this.commands()
            .filter((c) => c.enabled !== false)
            .filter((c) => !ql || c.title.toLowerCase().includes(ql))
            .map((command) => ({ kind: 'command' as const, command }));
    });

    readonly items = computed<PaletteItem[]>(() => {
        const syms: PaletteItem[] = this.symbols().map((symbol) => ({ kind: 'symbol', symbol }));
        const txts: PaletteItem[] = this.texts().map((match) => ({ kind: 'text', match }));
        const fileItems = this.fileItems();
        const commandItems = this.commandItems();
        switch (this.effScope()) {
            case 'files':
                return fileItems;
            case 'symbols':
                return syms;
            case 'actions':
                return commandItems;
            case 'text':
                return txts;
            default:
                return [
                    ...fileItems.slice(0, ALL_CAP),
                    ...syms.slice(0, ALL_CAP),
                    ...commandItems.slice(0, ALL_CAP),
                    ...txts.slice(0, ALL_CAP),
                ];
        }
    });

    constructor() {
        window.addEventListener('keydown', (e) => this.onGlobalKey(e));
    }

    private onGlobalKey(e: KeyboardEvent): void {
        // Double-Shift → Search Everywhere (IntelliJ). Ignore key-repeat and
        // reset the timer whenever any non-Shift key is pressed.
        if (e.key === 'Shift') {
            if (e.repeat) return;
            const now = Date.now();
            if (now - this.lastShift < DOUBLE_TAP_MS) {
                this.lastShift = 0;
                this.openWith('all');
            } else {
                this.lastShift = now;
            }
            return;
        }
        this.lastShift = 0;

        if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            this.openWith(e.shiftKey ? 'actions' : 'files');
        } else if (e.ctrlKey && (e.key === 't' || e.key === 'T')) {
            e.preventDefault();
            this.openWith('symbols');
        }
    }

    private openWith(scope: Scope): void {
        this.scope.set(scope);
        this.query.set('');
        this.active.set(0);
        this.isOpen.set(true);
        const root = this.project.root();
        if (root) walkProjectFiles(root).then((f) => this.files.set(f));
        this.refreshSymbolsAndText();
    }

    open(): void {
        this.openWith('all');
    }

    close(): void {
        this.isOpen.set(false);
    }

    setQuery(value: string): void {
        this.query.set(value);
        this.active.set(0);
        this.refreshSymbolsAndText();
    }

    selectScope(scope: Scope): void {
        this.scope.set(scope);
        const prefix = this.prefixScope();
        if (prefix) this.query.set(this.q());
        this.active.set(0);
    }

    cycleScope(delta: number): void {
        const i = SCOPES.indexOf(this.effScope());
        this.selectScope(SCOPES[(i + delta + SCOPES.length) % SCOPES.length]);
    }

    moveActive(delta: number): void {
        this.active.update((a) => Math.min(Math.max(a + delta, 0), this.items().length - 1));
    }

    private refreshSymbolsAndText(): void {
        const q = this.q();
        const scope = this.effScope();

        if (this.symbolTimer) clearTimeout(this.symbolTimer);
        const wantSymbols = scope === 'symbols' || (scope === 'all' && !!q);
        if (!wantSymbols) {
            this.symbols.set([]);
        } else {
            this.symbolTimer = setTimeout(() => {
                projectSymbols(q)
                    .then((s) => this.symbols.set(s.slice(0, MAX_RESULTS)))
                    .catch(() => this.symbols.set([]));
            }, 150);
        }

        if (this.textTimer) clearTimeout(this.textTimer);
        const wantText = !!q && (scope === 'text' || scope === 'all');
        if (!wantText) {
            this.texts.set([]);
        } else {
            this.textTimer = setTimeout(() => {
                searchProject(q, false)
                    .then((r) => this.texts.set((r?.matches ?? []).slice(0, MAX_RESULTS)))
                    .catch(() => this.texts.set([]));
            }, 200);
        }
    }
}
