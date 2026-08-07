import { registerMonacoThemes } from './monaco-themes';
import { registerLuauLanguage } from './luau-language';

// Modern bundler-agnostic worker wiring (works with both Vite's dev server and
// esbuild's production build) — no webpack plugin or static asset copy needed,
// unlike the classic min/vs AMD loader setup.
let configured = false;

export function configureMonacoEnvironment(): void {
    if (configured) return;
    configured = true;

    registerMonacoThemes();
    registerLuauLanguage();

    // Two constraints force the shape of the calls below, and breaking
    // either one fails *only* in the packaged app — never under `ng serve`,
    // whose dev server resolves node_modules on the fly:
    //   1. Each `new URL(..., import.meta.url)` must stay literally inline
    //      inside its `new Worker(...)`. esbuild (Angular's production
    //      bundler) only emits a worker bundle when it can see that pattern
    //      statically; hiding it behind a helper emits no worker files at
    //      all and leaves the specifier to 404 at runtime.
    //   2. `new URL` resolves *relative to this file*, not through node
    //      resolution, so the bare "monaco-editor/..." specifier can't be
    //      used here — it has to be a real relative path into node_modules.
    // When this breaks, Monaco silently falls back to running its workers on
    // the main thread ("Could not create web worker(s)") and freezes the UI
    // mid-render, which looks like a layout bug rather than a worker bug.
    (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
            switch (label) {
                case 'json':
                    return new Worker(
                        new URL('../../../node_modules/monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
                        { type: 'module' },
                    );
                case 'css':
                case 'scss':
                case 'less':
                    return new Worker(
                        new URL('../../../node_modules/monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
                        { type: 'module' },
                    );
                case 'html':
                    return new Worker(
                        new URL('../../../node_modules/monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
                        { type: 'module' },
                    );
                case 'typescript':
                case 'javascript':
                    return new Worker(
                        new URL('../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
                        { type: 'module' },
                    );
                default:
                    return new Worker(
                        new URL('../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
                        { type: 'module' },
                    );
            }
        },
    };
}
