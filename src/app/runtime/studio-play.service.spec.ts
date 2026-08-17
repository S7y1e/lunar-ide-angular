import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));

import { LogpointsService } from './logpoints.service';
import { StudioPlayService } from './studio-play.service';
import { ToastsService } from '../notifications/toasts.service';

// The order of these calls is the whole point: logpoints must be armed and the
// client agent planted *before* studio_play, and stripped only after Stop.
describe('StudioPlayService', () => {
    let studio: StudioPlayService;
    let logpoints: LogpointsService;
    let toasts: ToastsService;

    const calls = () => invoke.mock.calls.map(([cmd]) => cmd);

    beforeEach(() => {
        invoke.mockReset();
        invoke.mockResolvedValue(undefined);
        TestBed.configureTestingModule({});
        studio = TestBed.inject(StudioPlayService);
        logpoints = TestBed.inject(LogpointsService);
        toasts = TestBed.inject(ToastsService);
    });

    it('plants the client agent before playing, with no logpoints set', async () => {
        await studio.play(false);
        expect(calls()).toEqual(['client_agent_install', 'studio_play']);
        expect(invoke).toHaveBeenLastCalledWith('studio_play', { stop: false });
    });

    it('arms logpoints before the client agent and before play', async () => {
        vi.useFakeTimers();
        logpoints.add('src/client/init.client.luau', 3, 'x');
        const done = studio.play(false);
        await vi.runAllTimersAsync(); // the sync-settle wait
        await done;
        vi.useRealTimers();
        expect(calls()).toEqual(['logpoints_arm', 'client_agent_install', 'studio_play']);
        expect(logpoints.armed()).toBe(true);
    });

    it('disarms and removes the agent after Stop', async () => {
        logpoints.add('src/client/init.client.luau', 3, 'x');
        logpoints.armed.set(true);
        await studio.play(true);
        expect(calls()).toEqual(['studio_play', 'logpoints_disarm', 'client_agent_remove']);
        expect(invoke).toHaveBeenCalledWith('studio_play', { stop: true });
        expect(logpoints.armed()).toBe(false);
    });

    it('surfaces a failing studio_play as an error toast — the Linux/non-Windows path', async () => {
        invoke.mockImplementation((cmd) =>
            cmd === 'studio_play'
                ? Promise.reject('Play from the IDE is only available on Windows')
                : Promise.resolve(undefined),
        );
        await studio.play(false);
        const [toast] = toasts.toasts();
        expect(toast.kind).toBe('error');
        expect(toast.message).toBe('Play failed');
        expect(toast.detail).toContain('only available on Windows');
        expect(studio.busy()).toBe(false);
    });

    it('ignores a second click while a play is still in flight', async () => {
        vi.useFakeTimers();
        logpoints.add('src/client/init.client.luau', 3, 'x');
        const first = studio.play(false);
        await studio.play(false); // lands during the sync-settle wait
        await vi.runAllTimersAsync();
        await first;
        vi.useRealTimers();
        expect(calls().filter((c) => c === 'studio_play')).toHaveLength(1);
    });
});
