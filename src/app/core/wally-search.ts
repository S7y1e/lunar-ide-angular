import { fetch } from '@tauri-apps/plugin-http';

export type WallyHit = { scope: string; name: string; description: string; versions: string[] };

// Search the public Wally registry (no auth). Query is matched on package
// name; a `scope/name` input is reduced to its name segment.
export async function searchWally(query: string): Promise<WallyHit[]> {
    const q = (query.includes('/') ? query.split('/').pop()! : query).trim();
    if (q.length < 2) return [];
    const url = `https://api.wally.run/v1/package-search?query=${encodeURIComponent(q)}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Wally-Version': '0.3.2' } });
    if (!res.ok) return [];
    return (await res.json()) as WallyHit[];
}
