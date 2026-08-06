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

    (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
            const url = (path: string) => new URL(path, import.meta.url);
            switch (label) {
                case 'json':
                    return new Worker(url('monaco-editor/esm/vs/language/json/json.worker.js'), {
                        type: 'module',
                    });
                case 'css':
                case 'scss':
                case 'less':
                    return new Worker(url('monaco-editor/esm/vs/language/css/css.worker.js'), {
                        type: 'module',
                    });
                case 'html':
                    return new Worker(url('monaco-editor/esm/vs/language/html/html.worker.js'), {
                        type: 'module',
                    });
                case 'typescript':
                case 'javascript':
                    return new Worker(url('monaco-editor/esm/vs/language/typescript/ts.worker.js'), {
                        type: 'module',
                    });
                default:
                    return new Worker(url('monaco-editor/esm/vs/editor/editor.worker.js'), {
                        type: 'module',
                    });
            }
        },
    };
}
