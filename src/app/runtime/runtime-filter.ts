// Known engine/Studio noise that drowns out the game's own output — asset
// load failures and the like. Hidden by default; the user can toggle back on.
const NOISE: RegExp[] = [
    /rbxassetid:\/\//i,
    /\bassetid\b/i,
    /failed to load.*\basset/i,
    /\basset\b.*(failed|could not|not approved|not found|moderat)/i,
    /access permission to use asset/i,
    /click to share access/i,
];

export function isEngineNoise(text: string): boolean {
    return NOISE.some((re) => re.test(text));
}

// Internal Lunar protocol lines (profiler samples, asset-upload results)
// travel over the bridge's print channel — never meant for the user's console.
const INTERNAL = /^\s*\[lunar-[\w-]+\]/i;

export function isInternalLine(text: string): boolean {
    return INTERNAL.test(text);
}
