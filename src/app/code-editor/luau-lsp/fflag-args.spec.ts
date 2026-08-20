import { fflagArgs } from './fflag-args';
import { buildConfigRoot } from './config';

const config = (fflags: Record<string, unknown>) => ({ 'luau-lsp': { fflags } });

// These args decide which type solver analyses the user's code, and they are
// only read at server boot. The behaviour they have to match was checked
// against the bundled luau-lsp 1.68.1:
//   • with no args it enables every boolean Luau FFlag, but not LuauSolverV2
//   • --no-flags-enabled turns that off
//   • --flag:LuauSolverV2=True/False selects the solver either way
describe('fflagArgs', () => {
    it('opts out of the enable-everything default unless asked for', () => {
        expect(fflagArgs(config({}))).toContain('--no-flags-enabled');
        expect(fflagArgs(config({ enableByDefault: true }))).not.toContain('--no-flags-enabled');
    });

    it('states the solver explicitly in both directions, so the toggle is never inert', () => {
        expect(fflagArgs(config({ enableNewSolver: true }))).toContain('--flag:LuauSolverV2=True');
        expect(fflagArgs(config({ enableNewSolver: false }))).toContain('--flag:LuauSolverV2=False');
    });

    it('treats a missing solver setting as off rather than guessing', () => {
        expect(fflagArgs(config({}))).toContain('--flag:LuauSolverV2=False');
    });

    // luau-lsp resolves a repeated --flag to its first occurrence, so an
    // override listed after the solver flag would never take effect.
    it('puts overrides ahead of the solver flag, so an override of it wins', () => {
        const args = fflagArgs(config({ enableNewSolver: true, override: { LuauSolverV2: 'False' } }));
        expect(args.indexOf('--flag:LuauSolverV2=False')).toBeLessThan(
            args.indexOf('--flag:LuauSolverV2=True'),
        );
    });

    it('survives a config with no luau-lsp section at all', () => {
        expect(() => fflagArgs({})).not.toThrow();
    });
});

// What a user gets having changed nothing. Both of these shipped wrong and made
// the editor disagree with Studio: measured on a 120-file project, the new
// solver reported 2941 type errors where the old one reported 1486, and leaving
// the flags enabled by default added "Property OnServerInvoke ... is read-only"
// on top. Changing either default is a decision about that gap, not a tidy-up.
describe('shipped defaults', () => {
    const defaults = () => fflagArgs(buildConfigRoot({}));

    it('leaves the new solver off, matching Studio, where it is an opt-in beta', () => {
        expect(defaults()).toContain('--flag:LuauSolverV2=False');
    });

    it('does not let luau-lsp switch on every in-development Luau flag', () => {
        expect(defaults()).toContain('--no-flags-enabled');
    });
});
