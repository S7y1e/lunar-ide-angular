import { FileNode } from './file-node';

/**
 * Icons are from charmed-icons by Littensy (MIT).
 * See public/icons/charmed/LICENSE.md.
 */
const BASE = 'icons/charmed';

// The original resolved these through Vite's import.meta.glob, which let it fall
// back on a missing file at build time. Angular serves them from public/ as
// plain URLs, so the set has to be listed here for the fallbacks to work —
// keep it in sync with the directory.
const ICONS = new Set([
    '_file',
    '_folder',
    '_folder_open',
    'config',
    'folder_assets',
    'folder_assets_open',
    'folder_config',
    'folder_config_open',
    'folder_docs',
    'folder_docs_open',
    'folder_github',
    'folder_github_open',
    'folder_json',
    'folder_json_open',
    'folder_luau',
    'folder_luau_open',
    'folder_lune',
    'folder_lune_open',
    'folder_node',
    'folder_node_open',
    'folder_roblox',
    'folder_roblox_open',
    'folder_source',
    'folder_source_open',
    'folder_test',
    'folder_test_open',
    'folder_types',
    'folder_types_open',
    'folder_vscode',
    'folder_vscode_open',
    'git',
    'image',
    'json',
    'license',
    'lock',
    'lua',
    'luau',
    'markdown',
    'text',
    'toml',
    'yaml',
]);

const FILE_FALLBACK = '_file';
const FOLDER_FALLBACK = '_folder';
const FOLDER_OPEN_FALLBACK = '_folder_open';

const BY_FILENAME: Record<string, string> = {
    '.gitignore': 'git',
    '.gitattributes': 'git',
    '.gitmodules': 'git',
    '.luaurc': 'luau',
    '.editorconfig': 'config',
    license: 'license',
    'license.md': 'license',
    'license.txt': 'license',
    licence: 'license',
};

const BY_EXTENSION: Record<string, string> = {
    luau: 'luau',
    lua: 'lua',
    json: 'json',
    jsonc: 'json',
    toml: 'toml',
    md: 'markdown',
    markdown: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    txt: 'text',
    lock: 'lock',
    lockb: 'lock',
    cfg: 'config',
    conf: 'config',
    ini: 'config',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    bmp: 'image',
    svg: 'image',
    ico: 'image',
};

const BY_FOLDER_NAME: Record<string, string> = {
    src: 'source',
    source: 'source',
    luau: 'luau',
    lua: 'luau',
    roblox: 'roblox',
    lune: 'lune',
    json: 'json',
    test: 'test',
    tests: 'test',
    spec: 'test',
    __tests__: 'test',
    types: 'types',
    typings: 'types',
    '@types': 'types',
    node_modules: 'node',
    assets: 'assets',
    asset: 'assets',
    static: 'assets',
    public: 'assets',
    config: 'config',
    configs: 'config',
    '.config': 'config',
    '.github': 'github',
    '.vscode': 'vscode',
    docs: 'docs',
    doc: 'docs',
    documentation: 'docs',
};

const url = (name: string, fallback: string): string =>
    `${BASE}/${ICONS.has(name) ? name : fallback}.svg`;

const folderIcon = (name: string, expanded: boolean): string => {
    const suffix = BY_FOLDER_NAME[name.toLowerCase()];
    if (suffix) {
        const key = expanded ? `folder_${suffix}_open` : `folder_${suffix}`;
        return url(key, expanded ? FOLDER_OPEN_FALLBACK : FOLDER_FALLBACK);
    }
    return url(expanded ? FOLDER_OPEN_FALLBACK : FOLDER_FALLBACK, FOLDER_FALLBACK);
};

const fileIcon = (name: string): string => {
    const lower = name.toLowerCase();

    const byName = BY_FILENAME[lower];
    if (byName) return url(byName, FILE_FALLBACK);

    // Longest suffix first, so "init.client.luau" matches "luau" and a
    // hypothetical "foo.bundle.json" still lands on "json".
    const parts = lower.split('.');
    for (let i = 1; i < parts.length; i++) {
        const ext = parts.slice(i).join('.');
        const byExt = BY_EXTENSION[ext];
        if (byExt) return url(byExt, FILE_FALLBACK);
    }

    return url(FILE_FALLBACK, FILE_FALLBACK);
};

export const resolveFileIcon = (node: FileNode, expanded: boolean): string =>
    node.isDir ? folderIcon(node.name, expanded) : fileIcon(node.name);

export const fileIconFor = (name: string): string => fileIcon(name);
