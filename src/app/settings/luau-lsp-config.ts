export type LuauSettingType = 'boolean' | 'string' | 'number' | 'string[]' | 'record';

export type LuauSetting = {
    key: string;
    type: LuauSettingType;
    default: boolean | string | number | string[] | Record<string, string>;
    description: string;
    enum?: string[];
    min?: number;
    max?: number;
};

export const LUAU_SETTINGS: LuauSetting[] = [
    {
        key: 'luau-lsp.server.path',
        type: 'string',
        default: '',
        description: 'Path to the Luau LSP server binary. If empty, the binary is looked up on the PATH.',
    },
    {
        key: 'luau-lsp.server.communicationChannel',
        type: 'string',
        default: 'stdio',
        enum: ['stdio', 'pipe'],
        description: 'Type of communication channel to use for communicating with the server. Only useful for debug purposes.',
    },
    {
        key: 'luau-lsp.server.delayStartup',
        type: 'boolean',
        default: false,
        description: 'Make the server spin indefinitely on startup to allow time to attach a debugger.',
    },
    {
        key: 'luau-lsp.server.crashReporting.enabled',
        type: 'boolean',
        default: false,
        description: 'Upload crash reports to Sentry.',
    },
    {
        key: 'luau-lsp.server.baseLuaurc',
        type: 'string',
        default: '',
        description: 'Path to a .luaurc file which acts as the default baseline Luau configuration.',
    },
    {
        key: 'luau.trace.server',
        type: 'string',
        default: 'off',
        enum: ['off', 'messages', 'verbose'],
        description: 'Traces the communication between the editor and the Luau language server.',
    },

    {
        key: 'luau-lsp.platform.type',
        type: 'string',
        default: 'roblox',
        enum: ['standard', 'roblox'],
        description: 'Platform-specific support features.',
    },
    {
        key: 'luau-lsp.ignoreGlobs',
        type: 'string[]',
        default: ['**/_Index/**'],
        description: 'Diagnostics will not be reported for any file matching these globs unless the file is currently open.',
    },

    {
        key: 'luau-lsp.sourcemap.enabled',
        type: 'boolean',
        default: true,
        description: 'Whether Rojo sourcemap parsing is enabled.',
    },
    {
        key: 'luau-lsp.sourcemap.rojoPath',
        type: 'string',
        default: '',
        description: 'Path to the Rojo executable. If empty, `rojo` is run from the workspace and must be on the PATH.',
    },
    {
        key: 'luau-lsp.sourcemap.rojoProjectFile',
        type: 'string',
        default: 'default.project.json',
        description: 'The name of the Rojo project file to generate a sourcemap for.',
    },
    {
        key: 'luau-lsp.sourcemap.includeNonScripts',
        type: 'boolean',
        default: true,
        description: 'Include non-script instances in the generated sourcemap.',
    },
    {
        key: 'luau-lsp.sourcemap.sourcemapFile',
        type: 'string',
        default: 'sourcemap.json',
        description: 'The name of the sourcemap file.',
    },
    {
        key: 'luau-lsp.sourcemap.generatorCommand',
        type: 'string',
        default: '',
        description: 'A command to run to generate the sourcemap. Defaults to `rojo` if empty.',
    },
    {
        key: 'luau-lsp.sourcemap.useVSCodeWatcher',
        type: 'boolean',
        default: false,
        description: 'Use the editor filesystem watchers to regenerate the sourcemap instead of delegating to the generator process.',
    },

    {
        key: 'luau-lsp.diagnostics.includeDependents',
        type: 'boolean',
        default: true,
        description: 'Recompute diagnostics for dependents when a file changes. Ignored when workspace diagnostics are on.',
    },
    {
        key: 'luau-lsp.diagnostics.workspace',
        type: 'boolean',
        default: false,
        description: 'Compute diagnostics for the whole workspace.',
    },
    {
        key: 'luau-lsp.diagnostics.strictDatamodelTypes',
        type: 'boolean',
        default: false,
        description: 'Use strict DataModel types in diagnostics. When off, game/script/workspace are typed as any to reduce false positives.',
    },
    {
        key: 'luau-lsp.diagnostics.pullOnChange',
        type: 'boolean',
        default: true,
        description: 'Update document diagnostics whenever the text file changes.',
    },
    {
        key: 'luau-lsp.diagnostics.pullOnSave',
        type: 'boolean',
        default: true,
        description: 'Update document diagnostics whenever the text file is saved.',
    },

    {
        key: 'luau-lsp.types.definitionFiles',
        type: 'record',
        default: {},
        description: 'A mapping of package names to paths of definition files to load into the type checker.',
    },
    {
        key: 'luau-lsp.types.documentationFiles',
        type: 'string[]',
        default: [],
        description: 'A list of paths to documentation files which provide documentation for the definition files.',
    },
    {
        key: 'luau-lsp.types.disabledGlobals',
        type: 'string[]',
        default: [],
        description: 'A list of globals to remove from the global scope (e.g. `table` or `table.clone`).',
    },
    {
        key: 'luau-lsp.types.robloxSecurityLevel',
        type: 'string',
        default: 'PluginSecurity',
        enum: ['None', 'LocalUserSecurity', 'PluginSecurity', 'RobloxScriptSecurity'],
        description: 'Security level to use in the Roblox API definitions.',
    },

    {
        key: 'luau-lsp.fflags.enableByDefault',
        type: 'boolean',
        default: false,
        description: 'Enable all (boolean) Luau FFlags by default.',
    },
    {
        key: 'luau-lsp.fflags.enableNewSolver',
        type: 'boolean',
        default: true,
        description: "Enable the flags required for Luau's new type solver.",
    },
    {
        key: 'luau-lsp.fflags.sync',
        type: 'boolean',
        default: false,
        description: "Sync currently enabled FFlags with Roblox's published FFlags. Off by default so it can't clobber the new type solver.",
    },
    {
        key: 'luau-lsp.fflags.override',
        type: 'record',
        default: {},
        description: 'Override FFlags passed to Luau.',
    },

    {
        key: 'luau-lsp.inlayHints.parameterNames',
        type: 'string',
        default: 'none',
        enum: ['none', 'literals', 'all'],
        description: 'Show inlay hints for function parameter names.',
    },
    {
        key: 'luau-lsp.inlayHints.variableTypes',
        type: 'boolean',
        default: false,
        description: 'Show inlay hints for variable types.',
    },
    {
        key: 'luau-lsp.inlayHints.parameterTypes',
        type: 'boolean',
        default: false,
        description: 'Show inlay hints for parameter types.',
    },
    {
        key: 'luau-lsp.inlayHints.functionReturnTypes',
        type: 'boolean',
        default: false,
        description: 'Show inlay hints for function return types.',
    },
    {
        key: 'luau-lsp.inlayHints.hideHintsForErrorTypes',
        type: 'boolean',
        default: false,
        description: 'Hide type hints if they resolve to an error type.',
    },
    {
        key: 'luau-lsp.inlayHints.hideHintsForMatchingParameterNames',
        type: 'boolean',
        default: true,
        description: 'Hide type hints if the resolved variable name matches the parameter name.',
    },
    {
        key: 'luau-lsp.inlayHints.typeHintMaxLength',
        type: 'number',
        default: 50,
        min: 10,
        description: 'The maximum length a type hint should be before being truncated.',
    },
    {
        key: 'luau-lsp.inlayHints.makeInsertable',
        type: 'boolean',
        default: true,
        description: 'Allow type annotation inlay hints to be inserted by clicking.',
    },

    {
        key: 'luau-lsp.hover.enabled',
        type: 'boolean',
        default: true,
        description: 'Enable hover.',
    },
    {
        key: 'luau-lsp.hover.showTableKinds',
        type: 'boolean',
        default: false,
        description: 'Show table kinds.',
    },
    {
        key: 'luau-lsp.hover.multilineFunctionDefinitions',
        type: 'boolean',
        default: false,
        description: 'Show function definitions on multiple lines.',
    },
    {
        key: 'luau-lsp.hover.strictDatamodelTypes',
        type: 'boolean',
        default: true,
        description: 'Use strict DataModel types in hover display.',
    },
    {
        key: 'luau-lsp.hover.includeStringLength',
        type: 'boolean',
        default: true,
        description: 'Show string length when hovering over a string literal.',
    },

    {
        key: 'luau-lsp.completion.enabled',
        type: 'boolean',
        default: true,
        description: 'Enable autocomplete.',
    },
    {
        key: 'luau-lsp.completion.autocompleteEnd',
        type: 'boolean',
        default: false,
        description: 'Automatically insert an `end` when opening a block.',
    },
    {
        key: 'luau-lsp.completion.addParentheses',
        type: 'boolean',
        default: true,
        description: 'Add parentheses after completing a function call.',
    },
    {
        key: 'luau-lsp.completion.addTabstopAfterParentheses',
        type: 'boolean',
        default: true,
        description: 'Include a tabstop after the parentheses for the cursor to move to.',
    },
    {
        key: 'luau-lsp.completion.fillCallArguments',
        type: 'boolean',
        default: true,
        description: 'Fill parameter names in an autocompleted function call, tabbable through.',
    },
    {
        key: 'luau-lsp.completion.showPropertiesOnMethodCall',
        type: 'boolean',
        default: false,
        description: 'Show non-function properties when performing a method call with a colon.',
    },
    {
        key: 'luau-lsp.completion.showKeywords',
        type: 'boolean',
        default: true,
        description: 'Show keywords (if / then / and / etc.) during autocomplete.',
    },
    {
        key: 'luau-lsp.completion.anonymousAutofilledFunction.enabled',
        type: 'boolean',
        default: true,
        description: 'Show the auto-generated anonymous function completion item when autocompleting callback arguments.',
    },
    {
        key: 'luau-lsp.completion.anonymousAutofilledFunction.addTypeAnnotations',
        type: 'boolean',
        default: true,
        description: 'Include type annotations in the generated anonymous function snippet.',
    },
    {
        key: 'luau-lsp.completion.anonymousAutofilledFunction.addTabstopForParameters',
        type: 'boolean',
        default: true,
        description: 'Add snippet tabstops on each parameter name in the generated function snippet.',
    },
    {
        key: 'luau-lsp.completion.showDeprecatedItems',
        type: 'boolean',
        default: true,
        description: 'Show deprecated items in autocomplete suggestions.',
    },
    {
        key: 'luau-lsp.completion.imports.enabled',
        type: 'boolean',
        default: true,
        description: 'Suggest automatic imports in completion items.',
    },
    {
        key: 'luau-lsp.completion.imports.suggestServices',
        type: 'boolean',
        default: true,
        description: 'Suggest GetService completions in autocomplete.',
    },
    {
        key: 'luau-lsp.completion.imports.includedServices',
        type: 'string[]',
        default: [],
        description: 'When non-empty, only show the listed services when auto-importing.',
    },
    {
        key: 'luau-lsp.completion.imports.excludedServices',
        type: 'string[]',
        default: [],
        description: 'Do not show any of the listed services when auto-importing.',
    },
    {
        key: 'luau-lsp.completion.imports.suggestRequires',
        type: 'boolean',
        default: true,
        description: 'Suggest module requires in autocomplete.',
    },
    {
        key: 'luau-lsp.completion.imports.requireStyle',
        type: 'string',
        default: 'auto',
        enum: ['auto', 'alwaysRelative', 'alwaysAbsolute'],
        description: 'The style of requires when autocompleted.',
    },
    {
        key: 'luau-lsp.completion.imports.stringRequires.enabled',
        type: 'boolean',
        default: false,
        description: 'Use string requires when auto-importing. Only checked on the roblox platform.',
    },
    {
        key: 'luau-lsp.completion.imports.separateGroupsWithLine',
        type: 'boolean',
        default: false,
        description: 'Separate services and requires with an empty line.',
    },
    {
        key: 'luau-lsp.completion.imports.useConst',
        type: 'boolean',
        default: false,
        description: 'Use `const` instead of `local` for auto-imported requires and services.',
    },
    {
        key: 'luau-lsp.completion.imports.ignoreGlobs',
        type: 'string[]',
        default: ['**/_Index/**'],
        description: 'Files matching these globs will not be shown during auto-import.',
    },
    {
        key: 'luau-lsp.completion.enableFragmentAutocomplete',
        type: 'boolean',
        default: true,
        description: 'Enable the fragment autocomplete system for performance improvements.',
    },

    {
        key: 'luau-lsp.signatureHelp.enabled',
        type: 'boolean',
        default: true,
        description: 'Enable signature help.',
    },

    {
        key: 'luau-lsp.format.convertQuotes',
        type: 'boolean',
        default: false,
        description: 'Automatically convert single/double quotes to backticks when typing `{` inside strings.',
    },

    {
        key: 'luau-lsp.studioPlugin.enabled',
        type: 'boolean',
        default: false,
        description: 'Use the Roblox Studio plugin to provide DataModel information.',
    },
    {
        key: 'luau-lsp.studioPlugin.port',
        type: 'number',
        default: 3667,
        description: 'Port number to connect to the Studio plugin.',
    },
    {
        key: 'luau-lsp.studioPlugin.maximumRequestBodySize',
        type: 'string',
        default: '3mb',
        description: 'The maximum request body size accepted from the plugin.',
    },

    {
        key: 'luau-lsp.index.enabled',
        type: 'boolean',
        default: true,
        description: "Index all workspace files into memory. Required for full 'Find All References' and 'Rename'.",
    },
    {
        key: 'luau-lsp.index.maxFiles',
        type: 'number',
        default: 10000,
        description: 'The maximum amount of files that can be indexed.',
    },

    {
        key: 'luau-lsp.bytecode.debugLevel',
        type: 'number',
        default: 1,
        min: 0,
        max: 2,
        description: 'The debugLevel to use when compiling bytecode.',
    },
    {
        key: 'luau-lsp.bytecode.typeInfoLevel',
        type: 'number',
        default: 1,
        min: 0,
        max: 1,
        description: 'The typeInfoLevel to use when compiling bytecode.',
    },
    {
        key: 'luau-lsp.bytecode.vectorLib',
        type: 'string',
        default: 'Vector3',
        description: 'The vectorLib to use when compiling bytecode.',
    },
    {
        key: 'luau-lsp.bytecode.vectorCtor',
        type: 'string',
        default: 'new',
        description: 'The vectorCtor to use when compiling bytecode.',
    },
    {
        key: 'luau-lsp.bytecode.vectorType',
        type: 'string',
        default: 'Vector3',
        description: 'The vectorType to use when compiling bytecode.',
    },

    {
        key: 'luau-lsp.plugins.enabled',
        type: 'boolean',
        default: false,
        description: 'Enable source code transformation plugins that run before type checking.',
    },
    {
        key: 'luau-lsp.plugins.paths',
        type: 'string[]',
        default: [],
        description: 'Paths to Luau plugin scripts, executed in order before type checking.',
    },
    {
        key: 'luau-lsp.plugins.timeoutMs',
        type: 'number',
        default: 5000,
        min: 100,
        description: 'Timeout in milliseconds for plugin execution before it is terminated.',
    },
    {
        key: 'luau-lsp.plugins.fileSystem.enabled',
        type: 'boolean',
        default: false,
        description: 'Allow plugins to read files within the workspace.',
    },
];

const PREFIXES = ['luau-lsp.', 'luau.'];

const stripPrefix = (key: string): string => {
    for (const prefix of PREFIXES) {
        if (key.startsWith(prefix)) return key.slice(prefix.length);
    }
    return key;
};

const humanizeWord = (word: string): string => {
    if (word === 'fflags') return 'FFlags';
    const spaced = word.replace(/([A-Z])/g, ' $1');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const categoryOf = (key: string): string => humanizeWord(stripPrefix(key).split('.')[0]);

export const labelOf = (key: string): string => {
    const parts = stripPrefix(key).split('.');
    if (parts.length === 1) return humanizeWord(parts[0]);
    return parts.slice(1).map(humanizeWord).join(' › ');
};
