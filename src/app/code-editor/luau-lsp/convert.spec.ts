import * as monaco from 'monaco-editor';
import {
    toLspPosition,
    toMonacoLocations,
    toDocumentSymbols,
    toWorkspaceEdit,
    toMarker,
    toHover,
} from './convert';

// LSP counts lines and characters from 0; Monaco counts from 1. Every case
// below pins that offset, since an error in it lands the cursor one line or
// one column off the thing the server was talking about.
const range = (sl: number, sc: number, el: number, ec: number) => ({
    start: { line: sl, character: sc },
    end: { line: el, character: ec },
});

describe('toLspPosition', () => {
    it('drops Monaco back to 0-based', () => {
        expect(toLspPosition({ lineNumber: 1, column: 1 })).toEqual({ line: 0, character: 0 });
        expect(toLspPosition({ lineNumber: 12, column: 5 })).toEqual({ line: 11, character: 4 });
    });
});

describe('toMonacoLocations', () => {
    it('returns nothing for a null result', () => {
        expect(toMonacoLocations(null)).toEqual([]);
    });

    it('wraps a lone Location into a list and shifts to 1-based', () => {
        const out = toMonacoLocations({ uri: 'file:///p/a.luau', range: range(0, 0, 0, 4) });
        expect(out).toHaveLength(1);
        expect(out[0].uri.toString()).toBe('file:///p/a.luau');
        expect(out[0].range).toEqual({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 5,
        });
    });

    it('reads a LocationLink through its differently named fields', () => {
        const out = toMonacoLocations([
            {
                targetUri: 'file:///p/b.luau',
                targetRange: range(9, 0, 9, 20),
                targetSelectionRange: range(9, 6, 9, 12),
            },
        ]);
        expect(out[0].uri.toString()).toBe('file:///p/b.luau');
        // The selection range is the identifier itself, so it wins over the
        // full target range when the server sends both.
        expect(out[0].range.startColumn).toBe(7);
        expect(out[0].range.endColumn).toBe(13);
    });

    it('falls back to targetRange when there is no selection range', () => {
        const out = toMonacoLocations([
            { targetUri: 'file:///p/c.luau', targetRange: range(2, 1, 2, 8) },
        ]);
        expect(out[0].range.startColumn).toBe(2);
        expect(out[0].range.endColumn).toBe(9);
    });

    it('drops entries missing a uri or a range', () => {
        const out = toMonacoLocations([
            { uri: '', range: range(0, 0, 0, 1) },
            { uri: 'file:///p/d.luau', range: range(0, 0, 0, 1) },
        ] as never);
        expect(out).toHaveLength(1);
        expect(out[0].uri.toString()).toBe('file:///p/d.luau');
    });
});

describe('toDocumentSymbols', () => {
    it('returns nothing for a null result', () => {
        expect(toDocumentSymbols(null)).toEqual([]);
    });

    it('shifts SymbolKind from the 1-based LSP list to the 0-based Monaco one', () => {
        const [sym] = toDocumentSymbols([
            { name: 'f', kind: 12, range: range(0, 0, 3, 0), selectionRange: range(0, 9, 0, 10) },
        ]);
        expect(sym.kind).toBe(11);
    });

    it('never produces a negative kind', () => {
        const [sym] = toDocumentSymbols([
            { name: 'f', kind: 0, range: range(0, 0, 0, 1), selectionRange: range(0, 0, 0, 1) },
        ]);
        expect(sym.kind).toBe(0);
    });

    // selectionRange is required by the LSP spec and by our type, but the
    // converter falls back to `range` anyway. The cast is what a server that
    // omits it would hand us, which is the case that fallback exists for.
    it('falls back to the full range when no selection range is given', () => {
        const [sym] = toDocumentSymbols([
            { name: 'f', kind: 13, range: range(4, 2, 4, 9) },
        ] as never);
        expect(sym.selectionRange).toEqual(sym.range);
        expect(sym.range.startLineNumber).toBe(5);
    });

    it('converts nested children too', () => {
        const [sym] = toDocumentSymbols([
            {
                name: 'outer',
                kind: 13,
                range: range(0, 0, 9, 0),
                selectionRange: range(0, 6, 0, 11),
                children: [
                    {
                        name: 'inner',
                        kind: 13,
                        range: range(1, 4, 1, 9),
                        selectionRange: range(1, 4, 1, 9),
                    },
                ],
            },
        ]);
        expect(sym.children?.[0].name).toBe('inner');
        expect(sym.children?.[0].range.startLineNumber).toBe(2);
    });
});

describe('toWorkspaceEdit', () => {
    it('collects edits from the changes map', () => {
        const { edits } = toWorkspaceEdit({
            changes: { 'file:///p/a.luau': [{ range: range(0, 0, 0, 3), newText: 'New' }] },
        });
        expect(edits).toHaveLength(1);
        const e = edits[0] as monaco.languages.IWorkspaceTextEdit;
        expect(e.resource.toString()).toBe('file:///p/a.luau');
        expect(e.textEdit.text).toBe('New');
        expect(e.textEdit.range.startColumn).toBe(1);
    });

    it('collects edits from documentChanges as well, keeping both', () => {
        const { edits } = toWorkspaceEdit({
            changes: { 'file:///p/a.luau': [{ range: range(0, 0, 0, 1), newText: 'a' }] },
            documentChanges: [
                {
                    textDocument: { uri: 'file:///p/b.luau' },
                    edits: [{ range: range(0, 0, 0, 1), newText: 'b' }],
                },
            ],
        });
        expect(edits).toHaveLength(2);
    });

    it('survives an edit with neither field', () => {
        expect(toWorkspaceEdit({}).edits).toEqual([]);
    });
});

describe('toMarker', () => {
    it('maps LSP severities onto Monaco severities', () => {
        const at = (severity: number) =>
            toMarker({ range: range(0, 0, 0, 1), message: 'm', severity }).severity;
        expect(at(1)).toBe(monaco.MarkerSeverity.Error);
        expect(at(2)).toBe(monaco.MarkerSeverity.Warning);
        expect(at(3)).toBe(monaco.MarkerSeverity.Info);
        expect(at(4)).toBe(monaco.MarkerSeverity.Hint);
    });

    it('treats a missing or unknown severity as an error', () => {
        expect(toMarker({ range: range(0, 0, 0, 1), message: 'm' }).severity).toBe(
            monaco.MarkerSeverity.Error,
        );
        expect(toMarker({ range: range(0, 0, 0, 1), message: 'm', severity: 99 }).severity).toBe(
            monaco.MarkerSeverity.Error,
        );
    });

    it('shifts the range to 1-based', () => {
        const m = toMarker({ range: range(3, 7, 3, 11), message: 'm' });
        expect(m.startLineNumber).toBe(4);
        expect(m.startColumn).toBe(8);
        expect(m.endLineNumber).toBe(4);
        expect(m.endColumn).toBe(12);
    });
});

describe('toHover', () => {
    it('returns null for a null result', () => {
        expect(toHover(null)).toBeNull();
    });

    it('accepts a plain string as contents', () => {
        expect(toHover({ contents: 'hello' })?.contents).toEqual([{ value: 'hello' }]);
    });

    it('fences a markup object that names a language', () => {
        const h = toHover({ contents: { language: 'luau', value: 'local x' } });
        expect(h?.contents[0].value).toBe('```luau\nlocal x\n```');
    });

    it('drops empty parts and returns null when nothing is left', () => {
        expect(toHover({ contents: ['', { value: '' }] })).toBeNull();
        expect(toHover({ contents: ['', 'kept'] })?.contents).toEqual([{ value: 'kept' }]);
    });

    it('shifts the range to 1-based, and omits it when absent', () => {
        expect(toHover({ contents: 'x', range: range(1, 2, 1, 6) })?.range).toEqual({
            startLineNumber: 2,
            startColumn: 3,
            endLineNumber: 2,
            endColumn: 7,
        });
        expect(toHover({ contents: 'x' })?.range).toBeUndefined();
    });
});
