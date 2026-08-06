// Figma REST fetch. Pure-ish (uses global fetch); reused by the app later.

import type { FigmaNode } from "./figma-types";

// Pull file key + node id out of a Figma URL. node-id "2-4" -> "2:4".
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } {
    const key = url.match(/\/(?:design|file)\/([A-Za-z0-9]+)/)?.[1];
    const raw = new URL(url).searchParams.get("node-id");
    if (!key || !raw) throw new Error("URL missing file key or node-id");
    return { fileKey: key, nodeId: raw.replace("-", ":") };
}

// Caller injects fetch: global fetch in the CLI, tauri-plugin-http in the app
// (the latter is native, so no CORS against api.figma.com).
type FetchFn = typeof fetch;

export async function fetchFrame(
    fileKey: string,
    nodeId: string,
    token: string,
    fetchImpl: FetchFn = fetch,
): Promise<FigmaNode> {
    const res = await fetchImpl(
        `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
        { headers: { "X-Figma-Token": token } },
    );
    if (res.status === 429) {
        const wait = res.headers.get("Retry-After");
        throw new Error(`Figma rate limit hit. Wait ${wait ? `${wait}s` : "a minute"} and retry.`);
    }
    if (!res.ok) throw new Error(`Figma ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { nodes: Record<string, { document?: FigmaNode }> };
    const doc = json.nodes[nodeId]?.document;
    if (!doc) throw new Error(`node ${nodeId} not found in response`);
    return doc;
}
