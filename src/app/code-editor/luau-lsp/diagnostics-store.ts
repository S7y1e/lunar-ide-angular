import { type LspDiagnostic } from './convert';

// Central store of luau-lsp diagnostics, fed from every publishDiagnostics
// (open or not), so the Problems panel can list them across the project.
type Listener = () => void;

const byUri = new Map<string, LspDiagnostic[]>();
const listeners = new Set<Listener>();
let version = 0;

function emit(): void {
    version++;
    listeners.forEach((l) => l());
}

export function setDiagnostics(uri: string, diagnostics: LspDiagnostic[]): void {
    const relevant = diagnostics.filter((d) => (d.severity ?? 1) <= 2);
    if (relevant.length) byUri.set(uri, relevant);
    else byUri.delete(uri);
    emit();
}

export function clearDiagnostics(): void {
    byUri.clear();
    emit();
}

export function subscribeDiagnostics(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function diagnosticsVersion(): number {
    return version;
}

export function getDiagnostics(): Map<string, LspDiagnostic[]> {
    return byUri;
}
