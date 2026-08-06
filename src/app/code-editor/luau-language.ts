import * as monaco from 'monaco-editor';

const KEYWORDS = [
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true',
    'until', 'while', 'continue', 'export', 'type', 'typeof',
];

const configuration: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '--', blockComment: ['--[[', ']]'] },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' },
    ],
    indentationRules: {
        increaseIndentPattern:
            /^((?!--).)*(\b(else|elseif|do|then|repeat)\b|\b(function|if|for|while)\b.*|[{(])\s*$/,
        decreaseIndentPattern: /^\s*(\b(elseif|else|end|until)\b|[})])/,
    },
};

const tokenizer: monaco.languages.IMonarchLanguage = {
    defaultToken: '',
    keywords: KEYWORDS,
    operators: [
        '+', '-', '*', '/', '//', '%', '^', '#', '==', '~=', '<=', '>=', '<',
        '>', '=', '..', '...', '+=', '-=', '*=', '/=', '%=', '^=', '..=', '->',
        '?', '|', '&', '::',
    ],
    symbols: /[=><!~?:&|+\-*/^%#.]+/,
    escapes: /\\(?:[abfnrtv\\"'`]|x[0-9A-Fa-f]{2}|u\{[0-9A-Fa-f]+\}|z|\d{1,3})/,
    tokenizer: {
        root: [
            [
                /[a-zA-Z_]\w*/,
                { cases: { '@keywords': 'keyword', '@default': 'identifier' } },
            ],
            { include: '@whitespace' },
            [/[{}()[\]]/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
            [/\d+[eE][-+]?\d+/, 'number.float'],
            [/\d+\.\d*([eE][-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string_double' }],
            [/'/, { token: 'string.quote', bracket: '@open', next: '@string_single' }],
            [/`/, { token: 'string.quote', bracket: '@open', next: '@string_backtick' }],
            [/\[(=*)\[/, { token: 'string.quote', bracket: '@open', next: '@string_long.$1' }],
        ],
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/--\[(=*)\[/, { token: 'comment', next: '@comment_long.$1' }],
            [/--.*$/, 'comment'],
        ],
        comment_long: [
            [/[^\]]+/, 'comment'],
            [
                /\](=*)\]/,
                {
                    cases: {
                        '$1==$S2': { token: 'comment', next: '@pop' },
                        '@default': 'comment',
                    },
                },
            ],
            [/./, 'comment'],
        ],
        string_double: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        string_single: [
            [/[^\\']+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        string_backtick: [
            [/\{/, { token: 'delimiter.bracket', next: '@interp' }],
            [/[^\\`{]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/`/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        interp: [
            [/\}/, { token: 'delimiter.bracket', next: '@pop' }],
            { include: 'root' },
        ],
        string_long: [
            [/[^\]]+/, 'string'],
            [
                /\](=*)\]/,
                {
                    cases: {
                        '$1==$S2': { token: 'string.quote', bracket: '@close', next: '@pop' },
                        '@default': 'string',
                    },
                },
            ],
            [/./, 'string'],
        ],
    },
};

export function registerLuauLanguage(): void {
    if (monaco.languages.getLanguages().some((lang) => lang.id === 'luau')) return;
    monaco.languages.register({
        id: 'luau',
        extensions: ['.luau', '.lua'],
        aliases: ['Luau', 'luau'],
    });
    monaco.languages.setLanguageConfiguration('luau', configuration);
    monaco.languages.setMonarchTokensProvider('luau', tokenizer);
}
