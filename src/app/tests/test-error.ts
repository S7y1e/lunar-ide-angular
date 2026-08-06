// Drop TestEZ-internal and plugin stack frames so only the user's code shows.
const INTERNAL = /_Index|testez|Lunar-Plugin|_Lunar\.rbxm/i;
const FRAME = /^([\w.]+):(\d+)/;

export type ParsedError = {
    message: string;
    frames: { dotPath: string; line: number; raw: string }[];
};

export function parseError(err: string): ParsedError {
    const lines = err
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    // The first line is the message, prefixed by a TestEZ-internal path:line —
    // strip that so only the human-readable assertion text remains.
    const message = (lines[0] ?? '').replace(/^[\w.]+:\d+:\s*/, '');
    const frames: ParsedError['frames'] = [];
    for (const l of lines.slice(1)) {
        if (INTERNAL.test(l)) continue;
        const m = l.match(FRAME);
        if (m) frames.push({ dotPath: m[1], line: Number(m[2]), raw: l });
    }
    return { message, frames };
}
