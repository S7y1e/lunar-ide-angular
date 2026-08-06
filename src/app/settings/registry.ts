import { Setting } from './setting';
import { LUAU_SETTINGS, categoryOf, labelOf } from './luau-lsp-config';
import { ARGON_SETTINGS } from './argon-config';
import { APPEARANCE_SETTINGS } from './appearance-config';
import { EDITOR_SETTINGS } from './editor-config';
import { keybindSettings } from '../search/keybinds';
import { toolOrder, categoryOrder } from './settings-meta';

const luauSettings: Setting[] = LUAU_SETTINGS.map((s) => ({
    key: s.key,
    tool: 'Luau LSP',
    category: categoryOf(s.key),
    label: labelOf(s.key),
    type: s.type,
    default: s.default,
    description: s.description,
    enum: s.enum,
    min: s.min,
    max: s.max,
}));

export const ALL_SETTINGS: Setting[] = [
    ...APPEARANCE_SETTINGS,
    ...EDITOR_SETTINGS,
    ...keybindSettings(),
    ...luauSettings,
    ...ARGON_SETTINGS,
];

export type NavTool = { name: string; categories: string[] };

export function settingsNav(): NavTool[] {
    const tools: NavTool[] = [];
    for (const setting of ALL_SETTINGS) {
        let tool = tools.find((t) => t.name === setting.tool);
        if (!tool) {
            tool = { name: setting.tool, categories: [] };
            tools.push(tool);
        }
        if (!tool.categories.includes(setting.category)) {
            tool.categories.push(setting.category);
        }
    }
    tools.sort((a, b) => toolOrder(a.name) - toolOrder(b.name));
    for (const tool of tools) {
        tool.categories.sort((a, b) => categoryOrder(tool.name, a) - categoryOrder(tool.name, b) || a.localeCompare(b));
    }
    return tools;
}
