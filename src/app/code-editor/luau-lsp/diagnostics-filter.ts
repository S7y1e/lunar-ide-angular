import { readSettings, subscribeSettings, SettingsValues } from '../../core/settings-store';
import { type LspDiagnostic } from './lsp-types';

// Lunar-owned suppression of Luau lints (not a luau-lsp config key — those lints
// are only toggleable via .luaurc, so we filter them out of markers/Problems).
export const HIDE_UNUSED_KEY = 'lunar.diagnostics.hideUnused';

const UNUSED_CODES = new Set(['LocalUnused', 'FunctionUnused', 'ImportUnused']);

let hideUnused = false;
const listeners = new Set<() => void>();

const apply = (values: SettingsValues): void => {
    const next = values[HIDE_UNUSED_KEY] === true;
    if (next === hideUnused) return;
    hideUnused = next;
    listeners.forEach((l) => l());
};

readSettings().then(apply);
subscribeSettings(apply);

const isUnusedLint = (d: LspDiagnostic): boolean => {
    if (typeof d.code === 'string' && UNUSED_CODES.has(d.code)) return true;
    return d.source === 'Luau' && / is never used/.test(d.message);
};

export const filterDiagnostics = (diagnostics: LspDiagnostic[]): LspDiagnostic[] =>
    hideUnused ? diagnostics.filter((d) => !isUnusedLint(d)) : diagnostics;

/** Notify when the suppression toggle changes, so callers can re-filter. */
export const subscribeFilter = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
