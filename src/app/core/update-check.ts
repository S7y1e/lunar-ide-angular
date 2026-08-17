import { getVersion } from '@tauri-apps/api/app';

// Where 5.0.0 and later are published. Not the old S7y1e/Lunar-IDE repo, whose
// releases stop at the React 4.2.0 build — pointing here at that one would make
// every check conclude "nothing newer" and never notify.
const REPO = 'S7y1e/lunar-ide-angular';

export type UpdateInfo = { version: string; url: string };

// Deliberately the webview's own fetch, not @tauri-apps/plugin-http: GitHub's
// public API sends permissive CORS headers, so this needs no addition to the
// http capability scope in src-tauri/capabilities/default.json.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { tag_name?: string; html_url?: string };
        const latest = (data.tag_name ?? '').replace(/^v/, '').trim();
        const current = await getVersion();
        if (latest && isNewer(latest, current)) {
            return {
                version: latest,
                url: data.html_url ?? `https://github.com/${REPO}/releases/latest`,
            };
        }
        return null;
    } catch {
        // An update check must never disrupt startup — swallow network/parse
        // failures and simply report "no update".
        return null;
    }
}

export function isNewer(a: string, b: string): boolean {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x !== y) return x > y;
    }
    return false;
}
