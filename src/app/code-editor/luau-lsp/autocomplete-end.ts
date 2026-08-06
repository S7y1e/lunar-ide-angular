import * as monaco from "monaco-editor";

// Patterns that open a Luau block and require a matching `end`
const BLOCK_OPEN = /(?:^|\s)(?:then|do|repeat)$|^\s*(?:function\b.*\)$|function\b\s*$)/;

function lineOpensBlock(content: string): boolean {
    return BLOCK_OPEN.test(content.trimEnd());
}

function getBaseIndent(content: string): string {
    return content.match(/^(\s*)/)?.[1] ?? "";
}

export function registerAutocompleteEnd(
    editor: monaco.editor.IStandaloneCodeEditor,
    isEnabled: () => boolean
): monaco.IDisposable {
    let inserting = false;

    return editor.onDidChangeModelContent((e) => {
        if (!isEnabled() || inserting) return;

        for (const change of e.changes) {
            // Only react to a plain newline being inserted at a single position
            if (!/^\r?\n/.test(change.text)) continue;
            if (change.rangeLength !== 0) continue;

            const model = editor.getModel();
            if (!model) continue;

            const insertedLine = change.range.startLineNumber;
            const prevContent = model.getLineContent(insertedLine);

            if (!lineOpensBlock(prevContent)) continue;

            // After Monaco's auto-indent, cursor is now on insertedLine+1
            const cursorLine = insertedLine + 1;
            const cursorLineContent = model.getLineContent(cursorLine);
            const cursorCol = cursorLineContent.length + 1; // end of that line

            const baseIndent = getBaseIndent(prevContent);
            const textToInsert = "\n" + baseIndent + "end";

            inserting = true;
            editor.executeEdits("autocomplete-end", [
                {
                    range: new monaco.Range(cursorLine, cursorCol, cursorLine, cursorCol),
                    text: textToInsert,
                    forceMoveMarkers: false,
                },
            ]);
            inserting = false;

            // Keep cursor on the indented middle line, at end of its content
            editor.setPosition({ lineNumber: cursorLine, column: cursorCol });
            break;
        }
    });
}
