import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

const calls = vi.hoisted(() => [] as { cmd: string; args?: unknown }[]);
const reply = vi.hoisted(() => ({ value: null as unknown, rejectWith: null as string | null }));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (cmd: string, args?: unknown) => {
        calls.push({ cmd, args });
        return reply.rejectWith ? Promise.reject(reply.rejectWith) : Promise.resolve(reply.value);
    },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));

import { TestResultsService } from './test-results.service';

// The setup flow writes to the user's project — creating a wally.toml, editing
// lunar.toml, running an installer. What is pinned here is that nothing goes
// ahead until the user has confirmed the file they were shown.
describe('TestResultsService.setup', () => {
    let service: TestResultsService;

    beforeEach(() => {
        calls.length = 0;
        reply.value = null;
        reply.rejectWith = null;
        TestBed.configureTestingModule({});
        service = TestBed.inject(TestResultsService);
    });

    it('asks before creating a wally.toml, and asks for it not to be created', async () => {
        reply.value = { log: '', specFile: null, needsWally: '[package]\nname = "local/eb"\n' };

        const spec = await service.setup();

        expect(calls).toEqual([
            { cmd: 'project_setup_testez', args: { createWally: false } },
        ]);
        expect(service.pendingWally()).toBe('[package]\nname = "local/eb"\n');
        // No spec yet, and no log — the run stopped before it did anything.
        expect(spec).toBeNull();
        expect(service.setupLog()).toBeNull();
    });

    it('only passes createWally once the user has confirmed', async () => {
        reply.value = { log: '', specFile: null, needsWally: '[package]\n' };
        await service.setup();
        calls.length = 0;

        reply.value = { log: '• Created wally.toml\n', specFile: 'src/Tests/a.spec.luau', needsWally: null };
        const spec = await service.confirmWally();

        expect(calls).toEqual([{ cmd: 'project_setup_testez', args: { createWally: true } }]);
        expect(service.pendingWally()).toBeNull();
        expect(spec).toBe('src/Tests/a.spec.luau');
        expect(service.setupLog()).toBe('• Created wally.toml\n');
    });

    it('leaves the project untouched when the user cancels', async () => {
        reply.value = { log: '', specFile: null, needsWally: '[package]\n' };
        await service.setup();
        calls.length = 0;

        service.cancelWally();

        expect(service.pendingWally()).toBeNull();
        expect(calls).toEqual([]);
    });

    // The old failure mode: `wally install` exited 127 because the tool was not
    // on PATH, and the panel had to say so rather than sit on "Installing…".
    it('surfaces a failed install in the log and clears busy', async () => {
        reply.rejectWith = 'wally install failed (exit 127)';

        const spec = await service.setup();

        expect(spec).toBeNull();
        expect(service.setupLog()).toContain('exit 127');
        expect(service.busy()).toBe(false);
        expect(service.pendingWally()).toBeNull();
    });
});
