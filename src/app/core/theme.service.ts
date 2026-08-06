import { Injectable, effect, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';
import { applyUiScale, UI_SCALE_SETTING_KEY } from './ui-scale';

export type ThemeName =
    | 'luau'
    | 'luau-light'
    | 'nord'
    | 'dracula'
    | 'tokyo-night'
    | 'one-dark'
    | 'catppuccin-mocha'
    | 'gruvbox-dark'
    | 'studio';

export const THEMES: ThemeName[] = [
    'luau',
    'luau-light',
    'nord',
    'dracula',
    'tokyo-night',
    'one-dark',
    'catppuccin-mocha',
    'gruvbox-dark',
    'studio',
];

export const THEME_LABELS: Record<ThemeName, string> = {
    luau: 'Luau',
    'luau-light': 'Luau Light',
    nord: 'Nord',
    dracula: 'Dracula',
    'tokyo-night': 'Tokyo Night',
    'one-dark': 'One Dark',
    'catppuccin-mocha': 'Catppuccin Mocha',
    'gruvbox-dark': 'Gruvbox Dark',
    studio: 'Studio',
};

/** Monaco editor theme id registered for each app theme (see code-editor/monaco-themes.ts). */
export const MONACO_THEME: Record<ThemeName, string> = Object.fromEntries(
    THEMES.map((name) => [name, `lunar-${name}`]),
) as Record<ThemeName, string>;

export const DEFAULT_THEME: ThemeName = 'studio';
const THEME_SETTING_KEY = 'lunar.theme';

function normalizeTheme(value: unknown): ThemeName {
    return THEMES.includes(value as ThemeName) ? (value as ThemeName) : DEFAULT_THEME;
}

// Signal-based equivalent of lib/theme.ts + lib/ui-scale.ts combined — both are
// "Appearance" settings persisted through the same settings.json store.
// Components read `theme()` reactively instead of subscribing by hand.
@Injectable({ providedIn: 'root' })
export class ThemeService {
    readonly theme = signal<ThemeName>(DEFAULT_THEME);
    private readonly settings = inject(SettingsService);

    constructor() {
        this.apply(DEFAULT_THEME, false);

        effect(() => {
            if (!this.settings.loaded()) return;
            this.apply(normalizeTheme(this.settings.values()[THEME_SETTING_KEY]), false);
            applyUiScale(this.settings.values()[UI_SCALE_SETTING_KEY]);
        });
    }

    apply(theme: ThemeName, persist = true): void {
        this.theme.set(theme);
        document.documentElement.dataset['theme'] = theme;
        if (persist) this.settings.setValue(THEME_SETTING_KEY, theme);
    }

    /** Read the current theme's CSS token so JS-rendered surfaces (Monaco, xterm) can match it. */
    readToken(name: string): string {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(`--${name}`)
            .trim();
    }
}
