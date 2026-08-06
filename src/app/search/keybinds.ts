import { Setting } from '../settings/setting';

// Commands that can be bound to a shortcut. `id` matches a palette command in
// editor-commands.ts; the global keydown handler runs the matching command.
export type Bindable = { id: string; label: string; defaultKey: string };

export const BINDABLE: Bindable[] = [
    { id: 'build', label: 'Build: Place file', defaultKey: 'Ctrl+Shift+B' },
    { id: 'test', label: 'Test: Run tests', defaultKey: 'Ctrl+Shift+T' },
    { id: 'terminal.toggle', label: 'Terminal: Toggle', defaultKey: 'Ctrl+`' },
    { id: 'search.find', label: 'Search: Find in Files', defaultKey: 'Ctrl+Shift+F' },
    { id: 'refactor.renameModule', label: 'Refactor: Rename module', defaultKey: 'Shift+F6' },
    { id: 'view.structure', label: 'Go to: Structure', defaultKey: 'Alt+7' },
    { id: 'view.hierarchy', label: 'Go to: Hierarchy', defaultKey: '' },
    { id: 'callhierarchy.show', label: 'Call Hierarchy', defaultKey: 'Ctrl+Alt+H' },
    { id: 'usages.find', label: 'Find Usages', defaultKey: 'Alt+F7' },
    { id: 'sync.start', label: 'Sync: Start server', defaultKey: '' },
    { id: 'sync.stop', label: 'Sync: Stop server', defaultKey: '' },
    { id: 'runtime.clear', label: 'Runtime: Clear output', defaultKey: '' },
    { id: 'settings.open', label: 'Settings: Open', defaultKey: '' },
];

export const keybindKey = (id: string): string => `lunar.keybind.${id}`;

export function keybindSettings(): Setting[] {
    return BINDABLE.map((b) => ({
        key: keybindKey(b.id),
        tool: 'Editor',
        category: 'Keybindings',
        label: b.label,
        type: 'keybind',
        default: b.defaultKey,
        description: `Shortcut for "${b.label}". Click and press the keys; clear to unbind.`,
    }));
}

const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

// Canonical chord string from a keyboard event, e.g. "Ctrl+Shift+B". Returns
// null while only modifiers are held. The capture field and the global handler
// both use this so the stored chord and a live press compare equal.
export function chordFromEvent(e: KeyboardEvent): string | null {
    if (MODIFIERS.has(e.key)) return null;
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return parts.join('+');
}
