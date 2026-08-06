// Human-facing guide layered over the raw settings: which tools/categories
// matter most (ordering) and a one-line explanation for each. Keeps the screen
// from being a flat, unranked dump.

export type ToolMeta = { order: number; blurb: string };

export const TOOL_META: Record<string, ToolMeta> = {
    Editor: {
        order: 1,
        blurb: 'Look and feel of the IDE — theme, fonts, layout and shortcuts.',
    },
    'Luau LSP': {
        order: 2,
        blurb: 'Language intelligence: diagnostics, autocomplete, types and hovers.',
    },
    Argon: {
        order: 3,
        blurb: 'Sync, project scaffolding and package management.',
    },
};

// Most-changed categories first; anything unlisted falls to the end.
const CATEGORY_ORDER: Record<string, string[]> = {
    Editor: ['Appearance', 'Text', 'Display', 'Diagnostics', 'Keybindings', 'Updates'],
    'Luau LSP': [
        'Diagnostics',
        'Types',
        'Completion',
        'Inlay Hints',
        'Hover',
        'Signature Help',
        'Sourcemap',
        'Platform',
        'Format',
        'Index',
        'Studio Plugin',
        'Ignore Globs',
        'Server',
        'Trace',
        'FFlags',
        'Bytecode',
        'Plugins',
    ],
    Argon: ['Server', 'Project', 'Sync', 'Language', 'Updates', 'Privacy'],
};

export const CATEGORY_BLURB: Record<string, string> = {
    'Editor::Appearance': 'Color theme applied across the whole IDE.',
    'Editor::Text': 'Font, ligatures, tab size and word wrap.',
    'Editor::Display': 'Gutter, minimap, sticky scroll and whitespace rendering.',
    'Editor::Diagnostics': 'Which warnings the editor shows you.',
    'Editor::Keybindings': 'Keyboard shortcuts for commands.',
    'Editor::Updates': 'Automatic update checks for Lunar.',
    'Luau LSP::Diagnostics': 'How errors and warnings are computed across the project.',
    'Luau LSP::Types': 'Type definitions, security level and disabled globals.',
    'Luau LSP::Completion': 'Autocomplete behavior, auto-imports and snippets.',
    'Luau LSP::Inlay Hints': 'Inline type and parameter-name hints.',
    'Luau LSP::Hover': 'What the hover tooltip shows.',
    'Luau LSP::Sourcemap': 'How the DataModel sourcemap is generated and watched.',
    'Luau LSP::Platform': 'Roblox vs. standard Luau feature set.',
    'Luau LSP::Server': 'Language-server process and communication. Advanced.',
    'Luau LSP::FFlags': 'Luau feature flags. Changing these restarts the server.',
    'Luau LSP::Bytecode': 'Bytecode compilation options. Advanced.',
    'Luau LSP::Plugins': 'Source-transform plugins that run before type checking. Advanced.',
    'Argon::Server': 'Default host and port for the sync server.',
    'Argon::Project': 'Defaults used when scaffolding a new project.',
    'Argon::Sync': 'Two-way sync safety and behavior.',
    'Argon::Language': 'Rojo vs. roblox-ts and file extensions.',
};

export const toolOrder = (tool: string): number => TOOL_META[tool]?.order ?? 99;

export const categoryOrder = (tool: string, category: string): number => {
    const i = CATEGORY_ORDER[tool]?.indexOf(category) ?? -1;
    return i === -1 ? 99 : i;
};
