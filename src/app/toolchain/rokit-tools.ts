export type AvailableTool = { name: string; spec: string; description: string };

export const AVAILABLE_TOOLS: AvailableTool[] = [
    { name: 'rojo', spec: 'rojo-rbx/rojo', description: 'Project sync to Roblox Studio' },
    { name: 'argon', spec: 'argon-rbx/argon', description: 'Two-way sync tool' },
    { name: 'wally', spec: 'UpliftGames/wally', description: 'Package manager' },
    {
        name: 'wally-package-types',
        spec: 'JohnnyMorganz/wally-package-types',
        description: 'Export types for Wally packages',
    },
    { name: 'stylua', spec: 'JohnnyMorganz/StyLua', description: 'Luau code formatter' },
    { name: 'selene', spec: 'Kampfkarren/selene', description: 'Luau linter' },
    { name: 'luau-lsp', spec: 'JohnnyMorganz/luau-lsp', description: 'Luau language server' },
    { name: 'darklua', spec: 'seaofvoices/darklua', description: 'Luau code transformer' },
    { name: 'lune', spec: 'lune-org/lune', description: 'Standalone Luau runtime' },
    { name: 'tarmac', spec: 'rojo-rbx/tarmac', description: 'Asset manager' },
    { name: 'remodel', spec: 'rojo-rbx/remodel', description: 'Roblox place/model manipulation' },
    {
        name: 'run-in-roblox',
        spec: 'rojo-rbx/run-in-roblox',
        description: 'Run Luau in Roblox from the CLI',
    },
    { name: 'asphalt', spec: 'jacktabscode/asphalt', description: 'Asset upload tool' },
    { name: 'zap', spec: 'red-blox/zap', description: 'Networking code generator' },
    { name: 'moonwave', spec: 'evaera/moonwave', description: 'Documentation generator' },
    {
        name: 'mantle',
        spec: 'blake-mealey/mantle',
        description: 'Infrastructure-as-code deploy',
    },
    { name: 'foreman', spec: 'Roblox/foreman', description: 'Legacy toolchain manager' },
];
