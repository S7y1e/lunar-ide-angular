import { DataModelNode } from './project-queries';

const SCRIPT_EXT = /\.(luau|lua)$/i;

export const keyOf = (chain: string[]): string => JSON.stringify(chain);

export function scriptPath(node: DataModelNode): string | null {
    return node.filePaths?.find((p) => SCRIPT_EXT.test(p)) ?? null;
}

export function instancePath(chain: string[], rootIsGame: boolean): string {
    const tail = chain.slice(1);
    return (rootIsGame ? ['game', ...tail] : chain).join('.');
}

export function requireSnippet(chain: string[], rootIsGame: boolean): string {
    return `require(${instancePath(chain, rootIsGame)})`;
}

export function findInstanceChain(
    node: DataModelNode,
    relFile: string,
    trail: string[] = [],
): string[] | null {
    const here = [...trail, node.name];
    if (node.filePaths?.some((p) => p.replace(/\\/g, '/') === relFile)) {
        return here;
    }
    for (const child of node.children) {
        const found = findInstanceChain(child, relFile, here);
        if (found) return found;
    }
    return null;
}

export function defaultExpanded(root: DataModelNode): Set<string> {
    const keys = new Set<string>();
    const walk = (node: DataModelNode, trail: string[], depth: number) => {
        const here = [...trail, node.name];
        if (depth < 2) keys.add(keyOf(here));
        for (const child of node.children) walk(child, here, depth + 1);
    };
    walk(root, [], 0);
    return keys;
}
