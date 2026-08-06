import { open } from '@tauri-apps/plugin-dialog';
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export type FolderTemplate = 'game' | 'place' | 'plugin';

export type NewProjectOptions = {
    name: string;
    template: FolderTemplate;
    wally: boolean;
    stylua: boolean;
    selene: boolean;
};

type Layout = {
    tree: Record<string, unknown>;
    dirs: string[];
    files: Record<string, string>;
};

// Pinned starting versions for the Rokit manifest. Bump these as needed —
// they are only a template; users can run `rokit update` afterwards.
const TOOL_VERSIONS: Record<string, string> = {
    rojo: 'rojo-rbx/rojo@7.5.1',
    wally: 'UpliftGames/wally@0.3.2',
    stylua: 'JohnnyMorganz/StyLua@2.1.0',
    selene: 'Kampfkarren/selene@0.28.0',
};

const sluggify = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'game';

const PLUGIN_SOURCE =
    `local toolbar = plugin:CreateToolbar("${'%NAME%'}")\n` +
    `local button = toolbar:CreateButton(\n` +
    `\t"Run",\n` +
    `\t"An example plugin button",\n` +
    `\t""\n` +
    `)\n\n` +
    `button.Click:Connect(function()\n` +
    `\tprint("Hello from your plugin!")\n` +
    `end)\n`;

const layoutFor = (name: string, opts: NewProjectOptions): Layout => {
    const packages = opts.wally ? { Packages: { $path: 'Packages' } } : {};

    // Plugin: a single source tree built into a model/plugin with `rojo build`.
    if (opts.template === 'plugin') {
        return {
            tree: { $path: 'src' },
            dirs: [],
            files: {
                'src/init.server.luau': PLUGIN_SOURCE.replace('%NAME%', name),
            },
        };
    }

    // Place: a folder for every common service, so nothing is missing.
    if (opts.template === 'place') {
        return {
            tree: {
                $className: 'DataModel',
                Workspace: { $path: 'src/workspace' },
                ReplicatedFirst: { $path: 'src/replicatedFirst' },
                ReplicatedStorage: {
                    Shared: { $path: 'src/shared' },
                    ...packages,
                },
                ServerScriptService: { Server: { $path: 'src/server' } },
                ServerStorage: { $path: 'src/serverStorage' },
                StarterGui: { $path: 'src/starterGui' },
                StarterPack: { $path: 'src/starterPack' },
                StarterPlayer: {
                    StarterPlayerScripts: { Client: { $path: 'src/client' } },
                    StarterCharacterScripts: { $path: 'src/character' },
                },
            },
            dirs: [
                'src/workspace',
                'src/replicatedFirst',
                'src/serverStorage',
                'src/starterGui',
                'src/starterPack',
                'src/character',
                ...(opts.wally ? ['Packages'] : []),
            ],
            files: {
                'src/shared/Hello.luau': 'return "Hello from Lunar!"\n',
                'src/server/init.server.luau': 'print("Server started")\n',
                'src/client/init.client.luau': 'print("Client started")\n',
            },
        };
    }

    // Game (default): shared, server, client.
    return {
        tree: {
            $className: 'DataModel',
            ReplicatedStorage: {
                Shared: { $path: 'src/shared' },
                ...packages,
            },
            ServerScriptService: { Server: { $path: 'src/server' } },
            StarterPlayer: {
                StarterPlayerScripts: { Client: { $path: 'src/client' } },
            },
        },
        dirs: opts.wally ? ['Packages'] : [],
        files: {
            'src/shared/Hello.luau': 'return "Hello from Lunar!"\n',
            'src/server/init.server.luau': 'print("Server started")\n',
            'src/client/init.client.luau': 'print("Client started")\n',
        },
    };
};

const rokitManifest = (opts: NewProjectOptions): string => {
    const tools = ['rojo'];
    if (opts.wally) tools.push('wally');
    if (opts.stylua) tools.push('stylua');
    if (opts.selene) tools.push('selene');

    const lines = tools.map((tool) => `${tool} = "${TOOL_VERSIONS[tool]}"`);
    return `[tools]\n${lines.join('\n')}\n`;
};

const lunarManifest = (): string => `[sync]\nbackend = "rojo"\n\n[sourcemap]\nproject = "default.project.json"\n`;

const wallyManifest = (name: string): string =>
    `[package]\n` +
    `name = "user/${sluggify(name)}"\n` +
    `version = "0.1.0"\n` +
    `registry = "https://github.com/UpliftGames/wally-index"\n` +
    `realm = "shared"\n\n` +
    `[dependencies]\n`;

const STYLUA_CONFIG = `column_width = 120\nindent_type = "Tabs"\nindent_width = 4\nquote_style = "AutoPreferDouble"\n`;

const SELENE_CONFIG = `std = "roblox"\n`;

/**
 * Scaffolds a fresh project from the given options. Prompts the user for a
 * parent folder, then creates a `<parent>/<name>` directory containing a Rojo
 * project plus any selected tooling. Returns the project path, or null if the
 * user cancelled.
 */
export async function createProject(opts: NewProjectOptions): Promise<string | null> {
    const parent = await open({ multiple: false, directory: true, title: 'Choose where to create the project' });
    if (!parent) return null;

    const root = await join(parent, opts.name);
    await mkdir(root, { recursive: true });

    const layout = layoutFor(opts.name, opts);

    const project = JSON.stringify({ name: opts.name, tree: layout.tree }, null, 2) + '\n';

    const files: Record<string, string> = {
        'default.project.json': project,
        'lunar.toml': lunarManifest(),
        ...layout.files,
        'rokit.toml': rokitManifest(opts),
    };
    if (opts.wally) files['wally.toml'] = wallyManifest(opts.name);
    if (opts.stylua) files['stylua.toml'] = STYLUA_CONFIG;
    if (opts.selene) files['selene.toml'] = SELENE_CONFIG;

    // Empty service folders that have no sample file of their own.
    for (const dir of layout.dirs) {
        await mkdir(await join(root, ...dir.split('/')), { recursive: true });
    }

    for (const [relPath, contents] of Object.entries(files)) {
        const segments = relPath.split('/');
        if (segments.length > 1) {
            await mkdir(await join(root, ...segments.slice(0, -1)), { recursive: true });
        }
        await writeTextFile(await join(root, ...segments), contents);
    }

    return root;
}
