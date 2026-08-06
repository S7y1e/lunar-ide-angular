import { Setting } from './setting';
import { DEFAULT_THEME, THEMES, THEME_LABELS } from '../core/theme.service';
import { MIN_UI_SCALE, MAX_UI_SCALE } from '../core/ui-scale';

export const APPEARANCE_SETTINGS: Setting[] = [
    {
        key: 'lunar.theme',
        tool: 'Editor',
        category: 'Appearance',
        label: 'Theme',
        type: 'string',
        default: DEFAULT_THEME,
        enum: [...THEMES],
        enumLabels: THEME_LABELS,
        description: 'Color theme for the whole IDE (editor, panels and terminal).',
    },
    {
        key: 'lunar.ui.scale',
        tool: 'Editor',
        category: 'Appearance',
        label: 'UI scale',
        type: 'number',
        default: 1,
        min: MIN_UI_SCALE,
        max: MAX_UI_SCALE,
        description: 'Scales the whole app (panels, menus, text) up or down. 1 is 100%.',
    },
];
