import { invoke } from '@tauri-apps/api/core';
import { Command } from './commands';
import { LayoutService } from '../core/layout.service';
import { SettingsUiService } from '../settings/settings-ui.service';
import { ToolId } from '../core/layout.types';
import { ACTIVITY_VIEWS } from '../activity-bar/activity-views';
import { SyncService } from '../sync/sync.service';
import { BuildService } from '../build/build.service';
import { TestResultsService } from '../tests/test-results.service';
import { RuntimeBridgeService } from '../runtime/runtime-bridge.service';
import { ToastsService } from '../notifications/toasts.service';
import type { PaletteService } from './palette.service';
import { EditorGroupsService } from '../core/editor-groups.service';
import { RefactorUiService } from '../refactor/refactor-ui.service';
import { ProjectService } from '../core/project.service';
import { toRelative } from '../core/path';
import { organizeImports, organizeRequires } from '../core/project-queries';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';

// Port of use-editor-commands.ts.
export function buildEditorCommands(
    layout: LayoutService,
    settingsUi: SettingsUiService,
    sync: SyncService,
    build: BuildService,
    tests: TestResultsService,
    runtime: RuntimeBridgeService,
    toasts: ToastsService,
    palette: PaletteService,
    editorGroups: EditorGroupsService,
    refactorUi: RefactorUiService,
    project: ProjectService,
    navigation: EditorNavigationService,
): Command[] {
    const applyOrganize = async (cmd: (file: string) => Promise<string | null>, idleMsg: string): Promise<void> => {
        const root = project.root();
        const active = editorGroups.activeFile();
        if (!root || !active) return;
        try {
            const text = await cmd(toRelative(root, active));
            if (!text) {
                toasts.push('info', idleMsg);
                return;
            }
            editorGroups.setContent(text);
        } catch (e) {
            toasts.push('error', 'Organize failed', String(e));
        }
    };
    const goTo = (id: ToolId, title: string): Command => ({
        id: `view.${id}`,
        title: `Go to: ${title}`,
        run: () => layout.open(id),
    });

    return [
        {
            id: 'sync.start',
            title: 'Sync: Start server',
            hint: `${sync.backend()} · :${sync.port()}`,
            enabled: sync.status() !== 'running',
            run: () => sync.start(),
        },
        {
            id: 'sync.stop',
            title: 'Sync: Stop server',
            enabled: sync.status() === 'running',
            run: () => sync.stop(),
        },
        { id: 'build', title: 'Build: Place file', hint: `${sync.backend()} build`, run: () => build.build() },
        { id: 'test', title: 'Test: Run tests', hint: 'invokes project_run_test', run: () => build.test() },
        {
            id: 'test.testez',
            title: 'Test: Run (TestEZ)',
            hint: 'run TestEZ in Studio (edit mode)',
            run: () => {
                layout.open('tests');
                tests.run();
            },
        },
        { id: 'runtime.clear', title: 'Runtime: Clear output', run: () => runtime.clear() },
        {
            id: 'sourcemap.regenerate',
            title: 'Sourcemap: Regenerate',
            hint: 'rebuild sourcemap.json for the LSP',
            run: async () => {
                try {
                    await invoke('project_write_sourcemap');
                    toasts.push('success', 'Sourcemap regenerated');
                } catch (e) {
                    toasts.push('error', `Sourcemap failed: ${e}`);
                }
            },
        },
        { id: 'search.everywhere', title: 'Search Everywhere', hint: 'double-shift', run: () => palette.open() },
        { id: 'search.find', title: 'Search: Find in Files', run: () => layout.open('search') },
        { id: 'terminal.toggle', title: 'Terminal: Toggle', run: () => layout.toggle('terminal') },
        {
            id: 'refactor.renameModule',
            title: 'Refactor: Rename module…',
            hint: editorGroups.activeFile() ? undefined : 'open a module first',
            run: () =>
                editorGroups.activeFile()
                    ? refactorUi.renaming.set(true)
                    : toasts.push('error', 'Open a module file to rename it'),
        },
        {
            id: 'refactor.moveModule',
            title: 'Refactor: Move module…',
            hint: editorGroups.activeFile() ? 'move file + fix requires' : 'open a module first',
            run: () =>
                editorGroups.activeFile()
                    ? refactorUi.moving.set(true)
                    : toasts.push('error', 'Open a module file to move it'),
        },
        {
            id: 'callhierarchy.show',
            title: 'Call Hierarchy',
            run: () => {
                if (navigation.showCallHierarchy()) layout.open('callhierarchy');
            },
        },
        {
            id: 'usages.find',
            title: 'Find Usages',
            run: () => {
                if (navigation.showFindUsages()) layout.open('usages');
            },
        },
        {
            id: 'refactor.findRequirers',
            title: 'Refactor: Find Module Requirers',
            hint: 'who requires this module',
            run: () => {
                if (navigation.showRequirers()) layout.open('usages');
            },
        },
        {
            id: 'refactor.organizeRequires',
            title: 'Refactor: Organize Requires',
            hint: 'sort require statements',
            run: () => applyOrganize(organizeRequires, 'Requires already organized'),
        },
        {
            id: 'refactor.organizeImports',
            title: 'Refactor: Organize Imports',
            hint: 'sort whole block + drop unused',
            run: () => applyOrganize(organizeImports, 'Imports already tidy'),
        },
        ...ACTIVITY_VIEWS.map((v) => goTo(v.id, v.label)),
        { id: 'settings.open', title: 'Settings: Open', run: () => settingsUi.open.set(true) },
    ];
}
