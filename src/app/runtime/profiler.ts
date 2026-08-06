import { runtimeEnqueue } from '../core/project-queries';

export type ProfileSample = {
    t: number;
    mem: number; // total memory, MB
    hb: number; // heartbeat time, ms
    cats: Record<string, number>; // memory by DeveloperMemoryTag, MB
};

const PREFIX = '[lunar-profile] ';
export const DONE = '[lunar-profile-done]';

// A self-contained Luau sampler driven over the bridge's eval channel: it
// polls the Stats service every 250ms and prints one JSON line per sample,
// which the panel reads back from the runtime stream (no Rust/plugin changes).
export function buildProfileEval(seconds: number): string {
    const ticks = Math.max(1, Math.round(seconds / 0.25));
    return [
        'local Stats = game:GetService("Stats")',
        'local HttpService = game:GetService("HttpService")',
        `for i = 1, ${ticks} do`,
        '    local cats = {}',
        '    for _, tag in ipairs(Enum.DeveloperMemoryTag:GetEnumItems()) do',
        '        local ok, v = pcall(function() return Stats:GetMemoryUsageMbForTag(tag) end)',
        '        if ok and v and v > 0.01 then cats[tag.Name] = math.floor(v * 100) / 100 end',
        '    end',
        '    local mem = math.floor(Stats:GetTotalMemoryUsageMb() * 100) / 100',
        '    local hb = math.floor(Stats.HeartbeatTimeMs * 1000) / 1000',
        `    print("${PREFIX.trimEnd()} " .. HttpService:JSONEncode({ t = i, mem = mem, hb = hb, cats = cats }))`,
        '    task.wait(0.25)',
        'end',
        `print("${DONE}")`,
    ].join('\n');
}

export function sendProfile(seconds: number): Promise<void> {
    return runtimeEnqueue({ type: 'eval', code: buildProfileEval(seconds) });
}

// The latest contiguous run of samples; a new run resets when t === 1 reappears.
export function parseSamples(lines: string[]): ProfileSample[] {
    let run: ProfileSample[] = [];
    for (const line of lines) {
        const idx = line.indexOf(PREFIX);
        if (idx < 0) continue;
        try {
            const s = JSON.parse(line.slice(idx + PREFIX.length)) as ProfileSample;
            if (s.t === 1) run = [];
            run.push(s);
        } catch {
            // partial / non-JSON line
        }
    }
    return run;
}
