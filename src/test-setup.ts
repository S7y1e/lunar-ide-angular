/*
 * Global setup for the unit test run.
 *
 * Monaco's clipboard contribution calls document.queryCommandSupported at
 * import time. It is a deprecated API that the test environment does not
 * implement, so importing anything that reaches Monaco — App included, since
 * it owns the editor — threw before a single test ran. Reporting false is
 * accurate here: there is no execCommand-based clipboard under test.
 */
if (typeof document !== 'undefined' && !document.queryCommandSupported) {
    document.queryCommandSupported = () => false;
}

// Monaco's theme service escapes icon class names through CSS.escape while it
// builds its stylesheet, and the test environment ships no CSS object at all.
if (typeof globalThis.CSS === 'undefined') {
    (globalThis as { CSS?: unknown }).CSS = {};
}
if (typeof CSS.escape !== 'function') {
    CSS.escape = (value: string) => String(value).replace(/[^\w-]/g, (c) => `\\${c}`);
}

// Monaco measures and observes the viewport as it lays the editor out. None of
// these exist in the test environment; the stubs report a stable, empty
// viewport, which is all a non-visual test needs.
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
}
