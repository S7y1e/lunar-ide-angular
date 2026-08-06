import { Component, inject } from '@angular/core';
import { ThemeService } from './core/theme.service';
import { LayoutService } from './core/layout.service';
import { ProjectService } from './core/project.service';
import { ActivityBarComponent } from './activity-bar/activity-bar.component';
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

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        ActivityBarComponent,
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

    protected onRefactorDone(kind: 'Renamed' | 'Moved', newAbs: string): void {
        const oldPath = this.editorGroups.activeFile();
        this.refactorUi.renaming.set(false);
        this.refactorUi.moving.set(false);
        if (oldPath) this.editorGroups.renameFile(oldPath, newAbs);
        else this.editorGroups.openFile(newAbs);
        this.toasts.push('success', `${kind} to ${baseName(newAbs)}`, undefined, 5000);
    }
}
