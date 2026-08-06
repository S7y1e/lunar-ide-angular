import type { LuauLspClient } from "./client";

// The active LSP client, so non-editor surfaces (e.g. Call Hierarchy) can issue
// ad-hoc requests. Set by useLuauLsp on start, cleared on teardown.
let current: LuauLspClient | null = null;

export function setCurrentLspClient(client: LuauLspClient | null) {
    current = client;
}

export function getCurrentLspClient(): LuauLspClient | null {
    return current;
}
