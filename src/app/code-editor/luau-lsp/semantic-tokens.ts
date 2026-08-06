import * as monaco from "monaco-editor";

// The server may return a token whose position lies past the current model (a
// version race: tokens were computed for a slightly newer/older document).
// Monaco rejects the *entire* batch on a single out-of-bounds token, making all
// semantic highlighting vanish until the file is reopened. Walk the LSP
// delta-encoded stream, drop any token that doesn't fit the model, and re-encode
// the survivors so the rest still highlight.
export function sanitizeSemanticTokens(
    data: number[],
    model: monaco.editor.ITextModel
): Uint32Array {
    if (model.isDisposed()) return new Uint32Array();
    const out: number[] = [];
    const lineCount = model.getLineCount();
    // Absolute position while decoding the input stream.
    let absLine = 0;
    let absChar = 0;
    // Absolute position of the last token we kept, for re-encoding deltas.
    let lastLine = 0;
    let lastChar = 0;

    for (let i = 0; i + 4 < data.length; i += 5) {
        const dLine = data[i];
        const dStart = data[i + 1];
        const len = data[i + 2];
        const type = data[i + 3];
        const mods = data[i + 4];

        if (dLine === 0) {
            absChar += dStart;
        } else {
            absLine += dLine;
            absChar = dStart;
        }

        // Token lines are 0-indexed; Monaco lines are 1-indexed.
        const mLine = absLine + 1;
        if (mLine < 1 || mLine > lineCount) continue;

        const lineLen = model.getLineLength(mLine);
        if (absChar > lineLen) continue;
        const safeLen = Math.min(len, lineLen - absChar);
        if (safeLen <= 0) continue;

        const eDLine = absLine - lastLine;
        const eDStart = eDLine === 0 ? absChar - lastChar : absChar;
        out.push(eDLine, eDStart, safeLen, type, mods);
        lastLine = absLine;
        lastChar = absChar;
    }

    return new Uint32Array(out);
}
