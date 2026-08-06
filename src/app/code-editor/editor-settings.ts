import { SettingsValues } from '../core/settings-store';

// Keys mirror editor-config.ts's Setting registry — only the "Editor" tool
// slice is ported here (the generic Setting/registry framework isn't).
export const EDITOR_SETTING_KEYS = {
    fontSize: 'lunar.editor.fontSize',
    fontFamily: 'lunar.editor.fontFamily',
    fontLigatures: 'lunar.editor.fontLigatures',
    autoSave: 'lunar.editor.autoSave',
    autoSaveDelay: 'lunar.editor.autoSaveDelay',
    tabSize: 'lunar.editor.tabSize',
    wordWrap: 'lunar.editor.wordWrap',
    lineNumbers: 'lunar.editor.lineNumbers',
    minimap: 'lunar.editor.minimap',
    stickyScroll: 'lunar.editor.stickyScroll',
    renderWhitespace: 'lunar.editor.renderWhitespace',
} as const;

function settingGetter(values: SettingsValues) {
    return <T,>(key: string, fallback: T): T => (key in values ? (values[key] as T) : fallback);
}

export function editorOptionsFromSettings(values: SettingsValues) {
    const get = settingGetter(values);
    return {
        fontSize: Number(get(EDITOR_SETTING_KEYS.fontSize, 13)),
        fontFamily: get(EDITOR_SETTING_KEYS.fontFamily, "'JetBrains Mono', monospace"),
        fontLigatures: get(EDITOR_SETTING_KEYS.fontLigatures, true),
        wordWrap: get<'on' | 'off'>(EDITOR_SETTING_KEYS.wordWrap, 'off'),
        lineNumbers: get<'on' | 'off' | 'relative'>(EDITOR_SETTING_KEYS.lineNumbers, 'on'),
        minimap: { enabled: get(EDITOR_SETTING_KEYS.minimap, false) },
        stickyScroll: { enabled: get(EDITOR_SETTING_KEYS.stickyScroll, false) },
        renderWhitespace: get<'none' | 'boundary' | 'selection' | 'trailing' | 'all'>(
            EDITOR_SETTING_KEYS.renderWhitespace,
            'selection',
        ),
    };
}

export function tabSizeFromSettings(values: SettingsValues): number {
    return Number(settingGetter(values)(EDITOR_SETTING_KEYS.tabSize, 4));
}

export function autoSaveFromSettings(values: SettingsValues): { enabled: boolean; delayMs: number } {
    const get = settingGetter(values);
    return {
        enabled: get(EDITOR_SETTING_KEYS.autoSave, true),
        delayMs: Number(get(EDITOR_SETTING_KEYS.autoSaveDelay, 1)) * 1000,
    };
}
