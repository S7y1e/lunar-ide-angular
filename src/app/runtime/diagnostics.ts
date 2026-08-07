import { pathToUri } from '../core/monaco-uri';
import { RuntimeMessage } from './runtime-bridge.service';

export type RuntimeDiagnostic = {
    uri: string;
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
};

const LOCATION = /Script '([^']+)', Line (\d+)|((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+):(\d+)/;

// Derives per-file diagnostics from the runtime stream. An error message and its
// stack frame arrive as separate lines, so we carry the last error text forward
// and attach it to the resolvable frame that follows. Normal output resets it.
export function extractDiagnostics(
    messages: RuntimeMessage[],
    resolve: (dotPath: string) => string | null,
    root: string,
): RuntimeDiagnostic[] {
    const out: RuntimeDiagnostic[] = [];
    const seen = new Set<string>();
    let pending: string | null = null;

    for (const message of messages) {
        const match = LOCATION.exec(message.text);
        if (match) {
            const dotPath = match[1] ?? match[3];
            const line = Number(match[2] ?? match[4]);
            const source = resolve(dotPath);
            if (source) {
                const uri = pathToUri(`${root}/${source}`);
                const text = pending ?? message.text.trim();
                const key = `${uri}:${line}:${text}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push({
                        uri,
                        line,
                        message: text,
                        severity: pending ? 'error' : severityOf(message.type),
                    });
                }
            }
        } else if (message.type === 'error') {
            pending = message.text.trim();
        } else if (message.type === 'output') {
            pending = null;
        }
    }
    return out;
}

function severityOf(type: string): RuntimeDiagnostic['severity'] {
    return type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
}
