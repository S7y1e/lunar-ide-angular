type ConfigNode = Record<string, unknown>;

function getSection(root: ConfigNode): ConfigNode {
    const luau = root["luau-lsp"] as ConfigNode | undefined;
    return (luau?.["fflags"] as ConfigNode | undefined) ?? {};
}

// Translate the `luau-lsp.fflags.*` settings into `--flag:KEY=VALUE` CLI args.
// FFlags are process-global and locked at server boot, so passing them on the
// command line is the only reliable way to engage e.g. the new type solver —
// pushing them via didChangeConfiguration after startup does nothing.
export function fflagArgs(root: ConfigNode): string[] {
    const fflags = getSection(root);
    const args: string[] = [];

    // luau-lsp turns every boolean Luau FFlag on unless told not to, so the
    // setting only means anything if we pass this. Left off, the server runs
    // with in-development flags enabled and reports type errors that reproduce
    // nowhere else.
    if (fflags["enableByDefault"] !== true) {
        args.push("--no-flags-enabled");
    }

    // Overrides go first on purpose. Repeating --flag for one key is won by the
    // *first* occurrence, not the last (verified against luau-lsp 1.68.1 both
    // ways round), so listing them after the solver flag below would silently
    // make `override: { LuauSolverV2: ... }` unable to override anything.
    const override = fflags["override"];
    if (override && typeof override === "object") {
        for (const [key, value] of Object.entries(override as ConfigNode)) {
            args.push(`--flag:${key}=${String(value)}`);
        }
    }

    // Passed either way: with flags enabled by default, omitting it on `false`
    // would leave the solver on and make the toggle a no-op.
    args.push(`--flag:LuauSolverV2=${fflags["enableNewSolver"] === true ? "True" : "False"}`);

    return args;
}
