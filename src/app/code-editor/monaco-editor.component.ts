import {
    AfterViewInit,
    Component,
    ElementRef,
    Injector,
    OnChanges,
    OnDestroy,
    SimpleChanges,
    ViewChild,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import * as monaco from 'monaco-editor';
import { configureMonacoEnvironment } from './monaco-setup';
import { EDITOR_OPTIONS } from './editor-options';
import { languageFor } from './editor-language';
import { MONACO_THEME, ThemeService } from '../core/theme.service';
import { SettingsService } from '../core/settings.service';
import { editorOptionsFromSettings, tabSizeFromSettings, autoSaveFromSettings } from './editor-settings';
import { pathToUri } from '../core/monaco-uri';
import { registerAutocompleteEnd } from './luau-lsp/autocomplete-end';
import { ActiveEditorService } from './active-editor.service';

configureMonacoEnvironment();

// One Monaco model per open file path (keyed by its file:// URI), reused
// across tab switches instead of a single model whose value gets swapped —
// this is what lets the luau-lsp client (which tracks documents by URI via
// monaco.editor.onDidCreateModel/onWillDispose) see every open file as its
// own document, and is also what preserves undo history per tab.
@Component({
    selector: 'app-monaco-editor',
    standalone: true,
    templateUrl: './monaco-editor.component.html',
    styleUrl: './monaco-editor.component.scss',
})
export class MonacoEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
    readonly path = input<string | null>(null);
    readonly value = input('');
    readonly valueChange = output<string>();
    readonly save = output<void>();

    @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
    private readonly themeService = inject(ThemeService);
    private readonly settings = inject(SettingsService);
    private readonly injector = inject(Injector);
    private readonly activeEditor = inject(ActiveEditorService);
    private editor?: monaco.editor.IStandaloneCodeEditor;
    private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    private currentModel: monaco.editor.ITextModel | null = null;
    private contentSub?: monaco.IDisposable;
    private resizeObserver?: ResizeObserver;

    ngAfterViewInit(): void {
        this.editor = monaco.editor.create(this.host.nativeElement, {
            ...EDITOR_OPTIONS,
            ...editorOptionsFromSettings(this.settings.values()),
            theme: MONACO_THEME[this.themeService.theme()],
        });
        this.activeEditor.editor.set(this.editor);
        this.setModelForPath(this.path(), this.value());

        // `automaticLayout` in EDITOR_OPTIONS covers most resizes via
        // Monaco's own ResizeObserver, but that hasn't proven reliable
        // enough on its own (seen stuck at the size measured on creation
        // even after the host container genuinely resized) — likely a
        // webview-specific quirk. This explicit observer is the fallback
        // that's actually needed for the packaged app.
        this.resizeObserver = new ResizeObserver(() => this.editor?.layout());
        this.resizeObserver.observe(this.host.nativeElement);

        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            this.save.emit();
        });

        const reportCursor = (pos: monaco.Position | null) => {
            this.activeEditor.cursor.set(pos ? { line: pos.lineNumber, column: pos.column } : null);
        };
        reportCursor(this.editor.getPosition());
        this.editor.onDidChangeCursorPosition((e) => reportCursor(e.position));

        registerAutocompleteEnd(this.editor, () => this.settings.values()['luau-lsp.completion.autocompleteEnd'] === true);

        effect(
            () => {
                monaco.editor.setTheme(MONACO_THEME[this.themeService.theme()]);
            },
            { injector: this.injector },
        );

        // User editor settings applied on top of EDITOR_OPTIONS, live.
        effect(
            () => {
                const values = this.settings.values();
                this.editor!.updateOptions(editorOptionsFromSettings(values));
                this.currentModel?.updateOptions({ tabSize: tabSizeFromSettings(values), insertSpaces: true });
            },
            { injector: this.injector },
        );
    }

    private setModelForPath(path: string | null, initialValue: string): void {
        if (!this.editor) return;
        if (!path) {
            this.contentSub?.dispose();
            this.currentModel = null;
            this.editor.setModel(null);
            this.activeEditor.cursor.set(null);
            return;
        }
        const uri = monaco.Uri.parse(pathToUri(path));
        let model = monaco.editor.getModel(uri);
        if (!model) {
            model = monaco.editor.createModel(initialValue, languageFor(path), uri);
        }
        this.contentSub?.dispose();
        this.currentModel = model;
        this.editor.setModel(model);
        model.updateOptions({ tabSize: tabSizeFromSettings(this.settings.values()), insertSpaces: true });
        this.contentSub = model.onDidChangeContent(() => {
            this.valueChange.emit(model!.getValue());
            this.scheduleAutoSave();
        });
    }

    private scheduleAutoSave(): void {
        const { enabled, delayMs } = autoSaveFromSettings(this.settings.values());
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        if (!enabled) return;
        this.autoSaveTimer = setTimeout(() => this.save.emit(), delayMs);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!this.editor) return;
        if (changes['path']) {
            this.setModelForPath(this.path(), this.value());
            return;
        }
        // Path unchanged: an external rewrite of the same file's content
        // (organize imports/requires, a rename touching the active file).
        if (changes['value'] && this.currentModel && this.value() !== this.currentModel.getValue()) {
            this.currentModel.pushEditOperations([], [{ range: this.currentModel.getFullModelRange(), text: this.value() }], () => null);
        }
    }

    ngOnDestroy(): void {
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.resizeObserver?.disconnect();
        this.contentSub?.dispose();
        this.editor?.dispose();
        if (this.activeEditor.editor() === this.editor) {
            this.activeEditor.editor.set(null);
            this.activeEditor.cursor.set(null);
        }
    }
}
