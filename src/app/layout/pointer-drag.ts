// Shared window-level pointer-capture drag tracker, used by DockDragService
// and ResizeHandleComponent (the Tauri webview swallows native HTML5
// drag/drop, so both track pointermove/pointerup on window and hit-test
// manually). Centralized so the pointercancel handling below only needs to
// be correct once instead of being duplicated (and potentially missed) at
// every call site.
export type PointerDragHandlers = {
    // Called on every move once the drag has started (i.e. past `threshold`).
    onMove: (ev: PointerEvent) => void;
    // Called the first time the drag crosses `threshold`.
    onThresholdCrossed?: () => void;
    // Called on a normal pointerup. `moved` is false if the pointer never
    // crossed `threshold` — i.e. this was a click, not a drag.
    onEnd: (moved: boolean) => void;
    // Called on pointercancel (OS/webview interrupted the gesture — e.g.
    // alt-tab, palm rejection, a native drag starting mid-press) instead of
    // onEnd, so callers can distinguish "aborted" from "released". Defaults
    // to onEnd(false), i.e. treat a cancelled gesture as no-op/click.
    onCancel?: () => void;
    threshold?: number;
};

export function startPointerDrag(startEvent: PointerEvent, handlers: PointerDragHandlers): void {
    const threshold = handlers.threshold ?? 0;
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    let moved = threshold <= 0;
    if (moved) handlers.onThresholdCrossed?.();

    const cleanup = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
    };
    const move = (ev: PointerEvent): void => {
        if (!moved) {
            if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return;
            moved = true;
            handlers.onThresholdCrossed?.();
        }
        handlers.onMove(ev);
    };
    const up = (): void => {
        cleanup();
        handlers.onEnd(moved);
    };
    const cancel = (): void => {
        cleanup();
        if (handlers.onCancel) handlers.onCancel();
        else handlers.onEnd(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
}
