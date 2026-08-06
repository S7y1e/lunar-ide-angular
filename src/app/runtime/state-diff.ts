export type ChangeKind = 'added' | 'removed' | 'changed';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

const isObj = (v: JsonValue): v is { [k: string]: JsonValue } =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const keysOf = (v: JsonValue): string[] => {
    if (Array.isArray(v)) return v.map((_, i) => String(i));
    if (isObj(v)) return Object.keys(v);
    return [];
};

const childAt = (v: JsonValue, k: string): JsonValue | undefined => {
    if (Array.isArray(v)) return v[Number(k)];
    if (isObj(v)) return v[k];
    return undefined;
};

const branch = (v: JsonValue) => Array.isArray(v) || isObj(v);

export function diff(
    prev: JsonValue | undefined,
    next: JsonValue | undefined,
    path = '',
    out: Map<string, ChangeKind> = new Map(),
): Map<string, ChangeKind> {
    if (prev === undefined && next !== undefined) {
        out.set(path, 'added');
        return out;
    }
    if (next === undefined) {
        out.set(path, 'removed');
        return out;
    }

    if (branch(prev!) && branch(next)) {
        const keys = new Set([...keysOf(prev!), ...keysOf(next)]);
        for (const k of keys) {
            const p = path ? `${path}.${k}` : k;
            diff(childAt(prev!, k), childAt(next, k), p, out);
        }
        return out;
    }

    if (JSON.stringify(prev) !== JSON.stringify(next)) out.set(path, 'changed');
    return out;
}
