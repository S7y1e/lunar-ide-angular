import { readDir } from "@tauri-apps/plugin-fs";
import { join, basename } from "@tauri-apps/api/path";

const IGNORED = new Set([".git", "node_modules", "target", "dist", "build", ".idea"]);
const MAX_DEPTH = 8;

function isDefinition(name: string): boolean {
    return name.endsWith(".d.luau") || name.endsWith(".d.lua");
}

async function walk(dir: string, depth: number, out: string[]): Promise<void> {
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
        entries = await readDir(dir);
    } catch {
        return;
    }
    for (const entry of entries) {
        if (entry.isDirectory) {
            if (IGNORED.has(entry.name)) continue;
            await walk(await join(dir, entry.name), depth + 1, out);
        } else if (entry.isFile && isDefinition(entry.name)) {
            out.push(await join(dir, entry.name));
        }
    }
}

// Scan the workspace for `*.d.luau` definition files and map each to a package
// name (its filename without the `.d.luau` suffix) so luau-lsp loads it into the
// type checker. User-configured entries always win on key collision.
export async function discoverDefinitionFiles(
    root: string
): Promise<Record<string, string>> {
    const found: string[] = [];
    await walk(root, 0, found);

    const result: Record<string, string> = {};
    for (const path of found) {
        const name = (await basename(path)).replace(/\.d\.(luau|lua)$/, "");
        if (!(name in result)) result[name] = path;
    }
    return result;
}
