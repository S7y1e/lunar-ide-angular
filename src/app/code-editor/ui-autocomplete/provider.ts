import * as monaco from 'monaco-editor';
import { detectDslContext, type Library } from './dsl-context';
import { loadRobloxModel, type ClassMembers, type RobloxModel } from './model';

const LANGUAGES = ['lua', 'luau'];
const Kind = monaco.languages.CompletionItemKind;
const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

// Fusion key entries that aren't plain properties.
const FUSION_SENTINELS = [
    { label: '[Children]', insert: '[Children] = $0' },
    { label: '[Ref]', insert: '[Ref] = $0' },
    { label: '[Cleanup]', insert: '[Cleanup] = $0' },
    { label: '[Out "..."]', insert: '[Out "${1:Property}"] = $0' },
    { label: '[OnChange "..."]', insert: '[OnChange "${1:Property}"] = $0' },
];

function range(model: monaco.editor.ITextModel, position: monaco.IPosition): monaco.IRange {
    const word = model.getWordUntilPosition(position);
    return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    };
}

function classItems(api: RobloxModel, r: monaco.IRange): monaco.languages.CompletionItem[] {
    return [...api.creatable].map((name) => ({
        label: name,
        kind: Kind.Class,
        insertText: name,
        detail: 'Instance',
        range: r,
    }));
}

function keyItems(
    members: ClassMembers,
    detailFor: string,
    library: Library,
    r: monaco.IRange,
): monaco.languages.CompletionItem[] {
    const items: monaco.languages.CompletionItem[] = [];

    for (const p of members.props) {
        items.push({
            label: p.name,
            kind: Kind.Property,
            insertText: `${p.name} = $0`,
            insertTextRules: SNIPPET,
            detail: p.enumName ? `Enum.${p.enumName}` : detailFor,
            sortText: '0' + p.name,
            range: r,
        });
    }

    for (const e of members.events) {
        const insert =
            library === 'fusion'
                ? `[OnEvent "${e}"] = function($1)\n\t$0\nend`
                : `${e} = function($1)\n\t$0\nend`;
        items.push({
            label: library === 'fusion' ? `[OnEvent "${e}"]` : e,
            kind: Kind.Event,
            insertText: insert,
            insertTextRules: SNIPPET,
            detail: `${detailFor} event`,
            sortText: '1' + e,
            range: r,
        });
    }

    if (library === 'fusion') {
        for (const s of FUSION_SENTINELS) {
            items.push({
                label: s.label,
                kind: Kind.Snippet,
                insertText: s.insert,
                insertTextRules: SNIPPET,
                detail: 'Fusion',
                sortText: '2' + s.label,
                range: r,
            });
        }
    }

    return items;
}

function valueItems(
    api: RobloxModel,
    members: ClassMembers,
    propName: string,
    r: monaco.IRange,
): monaco.languages.CompletionItem[] {
    const prop = members.props.find((p) => p.name === propName);
    if (!prop?.enumName) return [];
    const enumMembers = api.enumMembers(prop.enumName);
    if (!enumMembers) return [];
    return enumMembers.map((m) => ({
        label: `Enum.${prop.enumName}.${m}`,
        kind: Kind.EnumMember,
        insertText: `Enum.${prop.enumName}.${m}`,
        filterText: m,
        detail: `Enum.${prop.enumName}`,
        sortText: '0' + m,
        range: r,
    }));
}

export function registerUiAutocomplete(): monaco.IDisposable[] {
    void loadRobloxModel();
    return LANGUAGES.map((language) =>
        monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: ['[', '"', '.'],
            async provideCompletionItems(model, position) {
                const api = await loadRobloxModel();
                if (!api) return null;
                const offset = model.getOffsetAt(position);
                const ctx = detectDslContext(model.getValue(), offset);
                if (!ctx) return null;
                const r = range(model, position);
                if (ctx.kind === 'class') return { suggestions: classItems(api, r) };

                const members = ctx.gui
                    ? api.guiMembers()
                    : ctx.className
                      ? api.membersOf(ctx.className)
                      : null;
                if (!members) return null;
                const label = ctx.gui ? 'GuiObject' : ctx.className!;
                const suggestions =
                    ctx.kind === 'key'
                        ? keyItems(members, label, ctx.library, r)
                        : valueItems(api, members, ctx.propName, r);
                return { suggestions };
            },
        }),
    );
}
