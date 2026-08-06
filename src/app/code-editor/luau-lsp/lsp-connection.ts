import { Command, Child } from "@tauri-apps/plugin-shell";

type JsonRpcMessage = {
    jsonrpc: "2.0";
    id?: number | string;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
};

type Pending = {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
};

export type NotificationHandler = (params: unknown) => void;
export type RequestHandler = (params: unknown) => unknown | Promise<unknown>;

const HEADER_TERMINATOR = [13, 10, 13, 10];

export class LspConnection {
    private child: Child | null = null;
    private nextId = 1;
    private pending = new Map<number, Pending>();
    private notificationHandlers = new Map<string, NotificationHandler>();
    private requestHandlers = new Map<string, RequestHandler>();
    private buffer = new Uint8Array(0);
    private writeChain: Promise<unknown> = Promise.resolve();
    private encoder = new TextEncoder();
    private decoder = new TextDecoder();

    async start(binary: string, args: string[]): Promise<void> {
        const command = Command.sidecar(binary, args, { encoding: "raw" });
        command.stdout.on("data", (data) => this.onData(data));
        command.stderr.on("data", (data) =>
            console.warn("[luau-lsp:stderr]", this.decoder.decode(toBytes(data)))
        );
        command.on("close", (payload) => console.warn("[luau-lsp] closed", payload));
        command.on("error", (error) => console.error("[luau-lsp] error", error));
        this.child = await command.spawn();
    }

    async stop(): Promise<void> {
        await this.child?.kill();
        this.child = null;
    }

    onNotification(method: string, handler: NotificationHandler): void {
        this.notificationHandlers.set(method, handler);
    }

    onRequest(method: string, handler: RequestHandler): void {
        this.requestHandlers.set(method, handler);
    }

    sendNotification(method: string, params?: unknown): void {
        this.write({ jsonrpc: "2.0", method, params });
    }

    sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
        const id = this.nextId++;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            this.write({ jsonrpc: "2.0", id, method, params });
        });
    }

    private write(message: JsonRpcMessage): void {
        const child = this.child;
        if (!child) return;
        const body = this.encoder.encode(JSON.stringify(message));
        const header = this.encoder.encode(`Content-Length: ${body.length}\r\n\r\n`);
        const frame = new Uint8Array(header.length + body.length);
        frame.set(header, 0);
        frame.set(body, header.length);
        this.writeChain = this.writeChain
            .then(() => child.write(frame))
            .catch((e) => console.error("[luau-lsp] write failed", e));
    }

    private onData(data: unknown): void {
        const incoming = toBytes(data);
        const merged = new Uint8Array(this.buffer.length + incoming.length);
        merged.set(this.buffer, 0);
        merged.set(incoming, this.buffer.length);
        this.buffer = merged;
        this.drain();
    }

    private drain(): void {
        for (;;) {
            const headerEnd = indexOfHeaderTerminator(this.buffer);
            if (headerEnd < 0) return;
            const header = this.decoder.decode(this.buffer.slice(0, headerEnd));
            const match = /content-length:\s*(\d+)/i.exec(header);
            const bodyStart = headerEnd + HEADER_TERMINATOR.length;
            if (!match) {
                this.buffer = this.buffer.slice(bodyStart);
                continue;
            }
            const length = parseInt(match[1], 10);
            if (this.buffer.length < bodyStart + length) return;
            const body = this.buffer.slice(bodyStart, bodyStart + length);
            this.buffer = this.buffer.slice(bodyStart + length);
            try {
                this.dispatch(JSON.parse(this.decoder.decode(body)));
            } catch (e) {
                console.error("[luau-lsp] failed to parse message", e);
            }
        }
    }

    private dispatch(message: JsonRpcMessage): void {
        if (message.id !== undefined && message.method) {
            this.handleServerRequest(message);
            return;
        }
        if (message.id !== undefined) {
            const pending = this.pending.get(message.id as number);
            if (!pending) return;
            this.pending.delete(message.id as number);
            if (message.error) pending.reject(message.error);
            else pending.resolve(message.result);
            return;
        }
        if (message.method) {
            this.notificationHandlers.get(message.method)?.(message.params);
        }
    }

    private async handleServerRequest(message: JsonRpcMessage): Promise<void> {
        const handler = this.requestHandlers.get(message.method as string);
        if (!handler) {
            this.write({
                jsonrpc: "2.0",
                id: message.id,
                error: { code: -32601, message: `Unhandled: ${message.method}` },
            });
            return;
        }
        try {
            const result = await handler(message.params);
            this.write({ jsonrpc: "2.0", id: message.id, result });
        } catch (e) {
            this.write({
                jsonrpc: "2.0",
                id: message.id,
                error: { code: -32603, message: String(e) },
            });
        }
    }
}

function toBytes(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (Array.isArray(data)) return Uint8Array.from(data as number[]);
    if (typeof data === "string") return new TextEncoder().encode(data);
    return new Uint8Array(0);
}

function indexOfHeaderTerminator(buf: Uint8Array): number {
    for (let i = 0; i + 3 < buf.length; i++) {
        if (
            buf[i] === HEADER_TERMINATOR[0] &&
            buf[i + 1] === HEADER_TERMINATOR[1] &&
            buf[i + 2] === HEADER_TERMINATOR[2] &&
            buf[i + 3] === HEADER_TERMINATOR[3]
        ) {
            return i;
        }
    }
    return -1;
}
