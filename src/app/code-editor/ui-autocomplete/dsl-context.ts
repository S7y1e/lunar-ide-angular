// Pure, model-agnostic detector: given source text and a cursor offset, decide
// whether the cursor sits inside a UI-library element (its class-name string, or
// its props table) and, if so, which Roblox class and what is expected next.

export type Library = 'fusion' | 'vide' | 'react';

// `gui: true` means the class is unknown (a Hydrate over an untyped instance) so
// the provider should offer the union of GUI-class members.
export type DslContext =
    | { kind: 'class'; library: Library }
    | { kind: 'key'; className?: string; gui?: boolean; library: Library }
    | { kind: 'value'; className?: string; gui?: boolean; propName: string }
    | null;

type Tok = { t: 'id' | 'str' | 'p'; v: string; end: number };

const ID_START = /[A-Za-z_]/;
const ID = /[A-Za-z0-9_]/;

// Identifiers that introduce an element, e.g. `New "X" {}` / `scope:New`. Seeded
// with conventional names, then extended with file aliases (`local new = F.New`).
function buildFactories(src: string): Map<string, Library> {
    const m = new Map<string, Library>([
        ['New', 'fusion'],
        ['create', 'vide'],
        ['createElement', 'react'],
        ['e', 'react'],
    ]);
    const re = /local\s+([A-Za-z_]\w*)\s*=\s*[^\n=]*[.:](New|create|Create|createElement)\b/g;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(src))) {
        const member = mt[2];
        m.set(mt[1], member === 'New' ? 'fusion' : member === 'createElement' ? 'react' : 'vide');
    }
    return m;
}

function tokenize(src: string, limit: number): { toks: Tok[]; openStr: boolean } {
    const toks: Tok[] = [];
    let i = 0;
    let openStr = false;
    while (i < limit) {
        const c = src[i];
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
            i++;
            continue;
        }
        if (c === '-' && src[i + 1] === '-') {
            i += 2;
            if (src[i] === '[') {
                const close = longClose(src, i);
                if (close) {
                    const end = src.indexOf(close, i);
                    i = end < 0 ? limit : end + close.length;
                    continue;
                }
            }
            while (i < limit && src[i] !== '\n') i++;
            continue;
        }
        if (c === '"' || c === "'") {
            const start = ++i;
            while (i < limit && src[i] !== c) {
                if (src[i] === '\\') i++;
                i++;
            }
            openStr = i >= limit; // ran into the cursor before the closing quote
            toks.push({ t: 'str', v: src.slice(start, i), end: i + 1 });
            i++;
            continue;
        }
        if (c === '[') {
            const close = longClose(src, i);
            if (close) {
                const inner = i + close.length;
                const end = src.indexOf(close, inner);
                toks.push({
                    t: 'str',
                    v: src.slice(inner, end < 0 ? limit : end),
                    end: end < 0 ? limit : end + close.length,
                });
                i = end < 0 ? limit : end + close.length;
                continue;
            }
        }
        if (ID_START.test(c)) {
            const start = i;
            while (i < limit && ID.test(src[i])) i++;
            toks.push({ t: 'id', v: src.slice(start, i), end: i });
            continue;
        }
        toks.push({ t: 'p', v: c, end: i + 1 });
        i++;
    }
    return { toks, openStr };
}

// Index of the `(` matching the `)` at `closeIdx`, or -1.
function matchOpen(toks: Tok[], closeIdx: number): number {
    let depth = 0;
    for (let k = closeIdx; k >= 0; k--) {
        if (toks[k].t !== 'p') continue;
        if (toks[k].v === ')') depth++;
        else if (toks[k].v === '(' && --depth === 0) return k;
    }
    return -1;
}

// `[[`, `[=[`, ... -> the matching close (`]]`, `]=]`). Null if not a long open.
function longClose(src: string, i: number): string | null {
    if (src[i] !== '[') return null;
    let j = i + 1;
    while (src[j] === '=') j++;
    if (src[j] !== '[') return null;
    return ']' + '='.repeat(j - i - 1) + ']';
}

export function detectDslContext(src: string, offset: number): DslContext {
    const factories = buildFactories(src);
    const { toks, openStr } = tokenize(src, offset);

    // Cursor inside the factory's class-name string -> complete the class name.
    // Covers curried `New "Text¦` and call form `New("Text¦`.
    if (openStr && toks[toks.length - 1]?.t === 'str') {
        const prev = toks[toks.length - 2];
        let lib = factories.get(prev?.v ?? '');
        if (!lib && prev?.v === '(') lib = factories.get(toks[toks.length - 3]?.v ?? '');
        if (lib) return { kind: 'class', library: lib };
    }

    // Walk forward, tracking the bracket stack. Each `(` frame remembers the call
    // name and its first string arg so React's `createElement("X", { … })` table
    // can inherit the class name from the enclosing call.
    type Frame = { open: string; idx: number; call?: string; firstStr?: string };
    const stack: Frame[] = [];
    for (let k = 0; k < toks.length; k++) {
        const tk = toks[k];
        if (tk.t === 'str') {
            const top = stack[stack.length - 1];
            if (top?.open === '(' && top.firstStr === undefined && top.idx === k - 1) {
                top.firstStr = tk.v;
            }
            continue;
        }
        if (tk.t !== 'p') continue;
        if (tk.v === '(' || tk.v === '{' || tk.v === '[') {
            const frame: Frame = { open: tk.v, idx: k };
            if (tk.v === '(' && toks[k - 1]?.t === 'id') frame.call = toks[k - 1].v;
            stack.push(frame);
        } else if (tk.v === ')' || tk.v === '}' || tk.v === ']') {
            stack.pop();
        }
    }

    // Innermost `{` frame is our candidate props table.
    let brace: { idx: number } | null = null;
    let parenCall: { call?: string; firstStr?: string } | null = null;
    for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].open === '{') {
            brace = { idx: stack[s].idx };
            for (let p = s - 1; p >= 0; p--) {
                if (stack[p].open === '(') {
                    parenCall = stack[p];
                    break;
                }
                if (stack[p].open === '{') break;
            }
            break;
        }
    }
    if (!brace) return null;

    // Resolve class name + library for this `{`. Forms: `F "X" {`, `F "X" ({`,
    // `F("X")({`, React `createElement("X", {`, and Fusion `:Hydrate(inst)({`.
    const b = brace.idx;
    const before = toks[b - 1];
    let className: string | undefined;
    let library: Library | undefined;
    let gui = false;
    const fac = (i: number) => factories.get(toks[i]?.v ?? '');
    const hydrate = (callOpen: number, callClose: number): boolean => {
        if (toks[callOpen - 1]?.v !== 'Hydrate' || toks[callOpen - 2]?.v !== ':') return false;
        library = 'fusion';
        const resolved = hydrateClass(toks.slice(callOpen + 1, callClose), src);
        if (resolved) className = resolved;
        else gui = true;
        return true;
    };
    if (before?.t === 'str' && fac(b - 2)) {
        className = before.v;
        library = fac(b - 2);
    } else if (before?.v === '(') {
        if (toks[b - 2]?.t === 'str' && fac(b - 3)) {
            className = toks[b - 2].v; // F "X" ({
            library = fac(b - 3);
        } else if (toks[b - 2]?.v === ')') {
            const m = matchOpen(toks, b - 2);
            if (m >= 0 && toks[m + 1]?.t === 'str' && fac(m - 1)) {
                className = toks[m + 1].v; // F("X")({
                library = fac(m - 1);
            } else if (m >= 0) {
                hydrate(m, b - 2); // :Hydrate(inst)({
            }
        }
    } else if (before?.v === ')') {
        const m = matchOpen(toks, b - 1);
        if (m >= 0) hydrate(m, b - 1); // :Hydrate(inst) {
    }
    // Comma call form `F("X", { … })`: React's createElement/e use it idiomatically.
    // Also accept it for any other known factory (e.g. vide.create, Fusion.New) so
    // completion still fires, even though those libs' canonical form is curried.
    if (!className && !gui && parenCall?.call && parenCall.firstStr) {
        const lib = factories.get(parenCall.call);
        if (lib) {
            className = parenCall.firstStr;
            library = lib;
        }
    }
    if ((!className && !gui) || !library) return null;

    // Key vs value: look at tokens after the last entry separator inside the `{`.
    let sep = brace.idx;
    let depth = 0;
    for (let k = brace.idx + 1; k < toks.length; k++) {
        const v = toks[k].v;
        if (toks[k].t === 'p') {
            if (v === '{' || v === '(' || v === '[') depth++;
            else if (v === '}' || v === ')' || v === ']') depth--;
            else if (depth === 0 && (v === ',' || v === ';')) sep = k;
        }
    }
    const entry = toks.slice(sep + 1);
    const eq = entry.findIndex((t) => t.t === 'p' && t.v === '=');
    if (eq >= 0) {
        const key = entry[eq - 1];
        if (key?.t === 'id') return { kind: 'value', className, gui, propName: key.v };
        return null;
    }
    return { kind: 'key', className, gui, library };
}

// Resolve the Roblox class of a Hydrate target from a type annotation or cast,
// e.g. `Hydrate(x :: TextLabel)`, `local x: TextLabel`, `local x = … :: TextLabel`.
function hydrateClass(argToks: Tok[], src: string): string | undefined {
    for (let i = 0; i < argToks.length - 2; i++) {
        if (argToks[i].v === ':' && argToks[i + 1].v === ':' && argToks[i + 2].t === 'id') {
            return argToks[i + 2].v;
        }
    }
    const id = argToks.find((t) => t.t === 'id');
    if (!id) return undefined;
    const v = id.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
        `(?:local\\s+${v}\\s*:|local\\s+${v}\\s*=[^\\n]*::|[(,]\\s*${v}\\s*:)\\s*([A-Za-z_]\\w*)`,
    );
    return re.exec(src)?.[1];
}
