import { Component, inject, signal } from '@angular/core';
import { ThemeService } from './core/theme.service';
import { LayoutService } from './core/layout.service';
import { ProjectService } from './core/project.service';
import { DockStripeComponent } from './layout/dock-stripe.component';
import { DockComponent } from './layout/dock.component';
import { EditorAreaComponent } from './code-editor/editor-area.component';
import { SettingsViewComponent } from './settings/settings-view.component';
import { SettingsUiService } from './settings/settings-ui.service';
import { TopBarComponent } from './topbar/topbar.component';
import { HomeComponent } from './home/home.component';
import { SearchPaletteComponent } from './search/search-palette.component';
import { ToastHostComponent } from './notifications/toast-host.component';
import { EditorGroupsService } from './core/editor-groups.service';
import { RefactorUiService } from './refactor/refactor-ui.service';
import { RenameDialogComponent } from './refactor/rename-dialog.component';
import { MoveDialogComponent } from './refactor/move-dialog.component';
import { ToastsService } from './notifications/toasts.service';
import { baseName } from './core/path';
import { FigmaImportService } from './figma-import/figma-import.service';
import { FigmaPreviewComponent } from './figma-import/figma-preview.component';
import { WindowCloseService } from './core/window-close.service';
import { GitGraphUiService } from './git/git-graph-ui.service';
import { GitGraphOverlayComponent } from './git/git-graph-overlay.component';
import { GlobalKeybindingsService } from './search/global-keybindings.service';
import { EditorNavigationService } from './code-editor/editor-navigation.service';
import { LuauLspService } from './code-editor/luau-lsp/luau-lsp.service';
import { StatusBarComponent } from './status-bar/status-bar.component';
import { RuntimeMarkersService } from './runtime/runtime-markers.service';
import { InsightsMarkersService } from './insights/insights-markers.service';
import { StudioPlayService } from './runtime/studio-play.service';
import { UpdateCheckService } from './core/update-check.service';
import { DockDragService } from './layout/dock-drag.service';
import { DropOverlayComponent } from './layout/drop-overlay.component';
import { ResizeHandleComponent } from './layout/resize-handle.component';

const MIN_SIDE_WIDTH = 180;
const MIN_BOTTOM_HEIGHT = 160;

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        DockStripeComponent,
        DockComponent,
        EditorAreaComponent,
        SettingsViewComponent,
        TopBarComponent,
        HomeComponent,
        SearchPaletteComponent,
        ToastHostComponent,
        RenameDialogComponent,
        MoveDialogComponent,
        FigmaPreviewComponent,
        GitGraphOverlayComponent,
        StatusBarComponent,
        DropOverlayComponent,
        ResizeHandleComponent,
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {
    protected readonly theme = inject(ThemeService);
    protected readonly layout = inject(LayoutService);
    protected readonly project = inject(ProjectService);
    protected readonly settingsUi = inject(SettingsUiService);
    protected readonly editorGroups = inject(EditorGroupsService);
    protected readonly refactorUi = inject(RefactorUiService);
    protected readonly figmaImport = inject(FigmaImportService);
    protected readonly gitGraphUi = inject(GitGraphUiService);
    private readonly toasts = inject(ToastsService);
    private readonly windowClose = inject(WindowCloseService);
    private readonly globalKeybindings = inject(GlobalKeybindingsService);
    private readonly editorNavigation = inject(EditorNavigationService);
    private readonly luauLsp = inject(LuauLspService);
    private readonly runtimeMarkers = inject(RuntimeMarkersService);
    // Eager, like runtimeMarkers: it paints the editor, so it must run whether
    // or not the Insights panel was ever opened.
    private readonly insightsMarkers = inject(InsightsMarkersService);
    // Eager: its leftover-agent/logpoint cleanup must run on project open even
    // when the Runtime panel was never opened.
    private readonly studioPlay = inject(StudioPlayService);
    // Eager: fires the one-shot startup update check.
    private readonly updateCheck = inject(UpdateCheckService);
    protected readonly dockDrag = inject(DockDragService);

    // Panel sizes, session-only (not persisted) — matches react-resizable-panels'
    // in-memory-only behavior in the original app.
    protected readonly leftWidth = signal(260);
    protected readonly rightWidth = signal(260);
    protected readonly bottomHeight = signal(240);

    protected resizeLeft(deltaPx: number): void {
        this.leftWidth.update((w) => Math.max(MIN_SIDE_WIDTH, w + deltaPx));
    }

    protected resizeRight(deltaPx: number): void {
        this.rightWidth.update((w) => Math.max(MIN_SIDE_WIDTH, w - deltaPx));
    }

    protected resizeBottom(deltaPx: number): void {
        this.bottomHeight.update((h) => Math.max(MIN_BOTTOM_HEIGHT, h - deltaPx));
    }

    protected onRefactorDone(kind: 'Renamed' | 'Moved', newAbs: string): void {
        const oldPath = this.editorGroups.activeFile();
        this.refactorUi.renaming.set(false);
        this.refactorUi.moving.set(false);
        if (oldPath) this.editorGroups.renameFile(oldPath, newAbs);
        else this.editorGroups.openFile(newAbs);
        this.toasts.push('success', `${kind} to ${baseName(newAbs)}`, undefined, 5000);
    }
}
