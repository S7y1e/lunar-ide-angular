import { RuntimeMessage } from './runtime-bridge.service';

export type StackFrame = { raw: string; dotPath: string; line: number; label: string };

export type ErrorGroup = { kind: 'error-group'; message: string; frames: StackFrame[] };
export type PlainMessage = RuntimeMessage & { kind: 'plain' };
export type GroupedEntry = ErrorGroup | PlainMessage;

const FRAME_SCRIPT = /Script '([^']+)', Line (\d+)(?: - (.+))?/;
const FRAME_INLINE = /^((?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+):(\d+)/;
const STACK_MARKER = /^Stack (Begin|End)$/;

function parseFrame(text: string): StackFrame | null {
    const s = FRAME_SCRIPT.exec(text);
    if (s) return { raw: text, dotPath: s[1], line: Number(s[2]), label: s[3] ?? '' };
    const i = FRAME_INLINE.exec(text);
    if (i) return { raw: text, dotPath: i[1], line: Number(i[2]), label: '' };
    return null;
}

// Groups a flat message list into plain messages and error groups.
// An error group = one error message + the stack frames that follow it.
export function groupMessages(messages: RuntimeMessage[]): GroupedEntry[] {
    const out: GroupedEntry[] = [];
    let i = 0;

    while (i < messages.length) {
        const msg = messages[i];

        if (msg.type === 'error') {
            const groupMsg = msg.text.trim();
            const frames: StackFrame[] = [];
            i++;

            while (i < messages.length) {
                const next = messages[i];
                const text = next.text.trim();

                if (STACK_MARKER.test(text)) {
                    i++;
                    continue;
                }
                if (next.type === 'error') {
                    const frame = parseFrame(text);
                    if (frame) {
                        frames.push(frame);
                        i++;
                        continue;
                    }
                }
                break;
            }

            out.push({ kind: 'error-group', message: groupMsg, frames });
        } else {
            out.push({ kind: 'plain', ...msg });
            i++;
        }
    }

    return out;
}
