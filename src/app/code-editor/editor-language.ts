export function languageFor(name: string): string {
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    switch (ext) {
        case 'luau':
        case 'lua':
            return 'luau';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'json':
        case 'jsonc':
            return 'json';
        case 'md':
        case 'markdown':
            return 'markdown';
        case 'css':
        case 'scss':
            return 'scss';
        case 'html':
            return 'html';
        case 'yml':
        case 'yaml':
            return 'yaml';
        default:
            return 'plaintext';
    }
}
