export const UI_SCALE_SETTING_KEY = 'lunar.ui.scale';
export const MIN_UI_SCALE = 0.75;
export const MAX_UI_SCALE = 1.5;
const DEFAULT_UI_SCALE = 1;

function normalize(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_UI_SCALE;
    return Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, n));
}

/**
 * Scale the whole UI without touching any component's own px values. Nearly
 * every SCSS module in this app hardcodes pixel sizes, so instead of a rem
 * migration this scales the root node visually and compensates its box size
 * by the inverse factor — the layout still measures/reflows as if unscaled,
 * only the final paint is bigger or smaller.
 */
export function applyUiScale(scale: unknown): void {
    document.documentElement.style.setProperty('--ui-scale', String(normalize(scale ?? DEFAULT_UI_SCALE)));
}
