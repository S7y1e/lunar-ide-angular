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

    if (fflags["enableNewSolver"] === true) {
        args.push("--flag:LuauSolverV2=True");
    }

    const override = fflags["override"];
    if (override && typeof override === "object") {
        for (const [key, value] of Object.entries(override as ConfigNode)) {
            args.push(`--flag:${key}=${String(value)}`);
        }
    }

    return args;
}
