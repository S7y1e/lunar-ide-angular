export type ClassIcon = { glyph: string; color: string };

// Angular port of data-model/class-icons.ts. The original picked react-icons
// VS Code glyphs; this maps the same intent onto Material Symbols ligatures,
// which is what mat-icon renders here. Every name below is present in the
// bundled @fontsource/material-symbols-outlined font.
const BY_CLASS: Record<string, string> = {
    DataModel: 'public', // VscGlobe
    Workspace: 'dns', // VscServer
    Players: 'group', // VscOrganization
    Lighting: 'lightbulb',
    SoundService: 'volume_up', // VscUnmute
    ReplicatedStorage: 'database',
    ReplicatedFirst: 'database',
    ServerStorage: 'database',
    ServerScriptService: 'dns',
    StarterGui: 'web_asset', // VscWindow
    StarterPack: 'category', // VscSymbolNamespace
    StarterPlayer: 'group',
    Folder: 'folder',
    ModuleScript: 'function', // VscSymbolMethod
    ScreenGui: 'web_asset',
    Frame: 'web_asset',
};

function glyph(className: string): string {
    const specific = BY_CLASS[className];
    if (specific) return specific;
    if (className.endsWith('Script')) return 'description'; // VscFileCode
    if (className.endsWith('Event') || className.endsWith('Function')) return 'bolt'; // VscSymbolEvent
    if (className.endsWith('Value')) return 'data_object'; // VscSymbolVariable
    return 'category';
}

function tint(className: string): string {
    switch (className) {
        case 'DataModel':
            return 'var(--success)';
        case 'Folder':
            return 'var(--icon)';
        case 'ModuleScript':
            return 'var(--warning)';
        case 'Script':
            return 'var(--success)';
        case 'LocalScript':
            return 'var(--brand)';
    }
    if (className.endsWith('Script')) return 'var(--accent)';
    if (className.endsWith('Event') || className.endsWith('Function')) return 'var(--warning)';
    if (className.endsWith('Value')) return 'var(--muted)';
    return 'var(--accent)';
}

export function iconForClass(className: string): ClassIcon {
    return { glyph: glyph(className), color: tint(className) };
}
