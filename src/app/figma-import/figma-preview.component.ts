import {
    AfterViewInit,
    Component,
    ElementRef,
    HostListener,
    Injector,
    OnDestroy,
    ViewChild,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { generateLuau } from './generate-luau';
import { runtimeEnqueue } from '../core/project-queries';
import { buildApplyLuau, buildUploadLuau, getCachedAsset, pngToRgba, FigmaImage } from './upload-image';
import { isTextClass, UiNode, RobloxClass } from './figma-types';
import { FigmaNodeViewComponent, SelectCtx, TextPatch } from './figma-node-view.component';
import { FigmaTreeManagerComponent } from './figma-tree-manager.component';
import { toggleInSet, toggleAllInSet, withAdded, withRemoved } from '../core/set-utils';

type RootMode = 'ScreenGui' | 'Frame';
type SizeMode = 'Offset' | 'Scaled';

const CLASSES: RobloxClass[] = [
    'Frame',
    'ScrollingFrame',
    'CanvasGroup',
    'TextLabel',
    'TextButton',
    'TextBox',
    'ImageLabel',
    'ImageButton',
    'ViewportFrame',
];

function countNodes(n: UiNode): number {
    return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}

function findNode(n: UiNode, id: string): UiNode | null {
    if (n.id === id) return n;
    for (const c of n.children) {
        const r = findNode(c, id);
        if (r) return r;
    }
    return null;
}

function patchTree(
    n: UiNode,
    overrides: Map<string, RobloxClass>,
    excluded: Set<string>,
    noStroke: Set<string>,
    textPatches: Map<string, TextPatch>,
    useFigmaNames: boolean,
): UiNode | null {
    if (excluded.has(n.id)) return null;
    let props = noStroke.has(n.id) ? { ...n.props, stroke: undefined } : n.props;
    const tp = textPatches.get(n.id);
    if (tp) {
        props = { ...props };
        if (tp.color) props.textColor = tp.color.match(/\d+/g)!.map(Number) as [number, number, number];
        if (tp.size !== undefined) props.textSize = tp.size;
        if (tp.transparent) props.backgroundTransparency = 1;
    }
    return {
        ...n,
        name: useFigmaNames ? n.figmaName : n.name,
        className: overrides.get(n.id) ?? n.className,
        props,
        children: n.children
            .map((c) => patchTree(c, overrides, excluded, noStroke, textPatches, useFigmaNames))
            .filter((c): c is UiNode => c !== null),
    };
}

@Component({
    selector: 'app-figma-preview',
    standalone: true,
    imports: [FigmaTreeManagerComponent, FigmaNodeViewComponent],
    templateUrl: './figma-preview.component.html',
    styleUrl: './figma-preview.component.scss',
})
export class FigmaPreviewComponent implements AfterViewInit, OnDestroy {
    readonly trees = input.required<UiNode[]>();
    readonly images = input.required<FigmaImage[]>();
    readonly close = output<void>();

    @ViewChild('viewport') private viewportEl!: ElementRef<HTMLDivElement>;
    private readonly injector = inject(Injector);
    private resizeObserver?: ResizeObserver;
    private initialIdxSet = false;

    protected readonly selectedIdx = signal(0);
    protected readonly rootMode = signal<RootMode>('ScreenGui');
    protected readonly sizeMode = signal<SizeMode>('Scaled');
    protected readonly sent = signal(false);
    protected readonly scale = signal(1);
    protected readonly selectedIds = signal<Set<string>>(new Set());
    protected readonly overrides = signal<Map<string, RobloxClass>>(new Map());
    protected readonly excluded = signal<Set<string>>(new Set());
    protected readonly noStroke = signal<Set<string>>(new Set());
    protected readonly textPatches = signal<Map<string, TextPatch>>(new Map());
    protected readonly useFigmaNames = signal(false);

    protected readonly classes = CLASSES;

    protected readonly tree = computed<UiNode | undefined>(() => {
        const trees = this.trees();
        return trees[Math.min(this.selectedIdx(), trees.length - 1)];
    });

    protected readonly nodeCount = computed(() => {
        const t = this.tree();
        return t ? countNodes(t) : 0;
    });

    protected readonly imageMap = computed(
        () => new Map(this.images().map((img) => [img.hash, `data:image/png;base64,${img.png}`])),
    );

    protected readonly selectCtx = computed<SelectCtx>(() => ({
        selected: this.selectedIds(),
        excluded: this.excluded(),
        overrides: this.overrides(),
        noStroke: this.noStroke(),
        textPatches: this.textPatches(),
        images: this.imageMap(),
        onSelect: (id, multi) => this.onSelect(id, multi),
    }));

    protected readonly singleNode = computed<UiNode | null>(() => {
        const t = this.tree();
        const ids = this.selectedIds();
        return t && ids.size === 1 ? findNode(t, [...ids][0]) : null;
    });

    protected readonly singleCls = computed<RobloxClass | null>(() => {
        const n = this.singleNode();
        return n ? (this.overrides().get(n.id) ?? n.className) : null;
    });

    protected readonly isTextNode = computed(() => {
        const cls = this.singleCls();
        return cls !== null && isTextClass(cls);
    });

    constructor() {
        effect(() => {
            const trees = this.trees();
            if (!this.initialIdxSet && trees.length > 0) {
                this.initialIdxSet = true;
                this.selectedIdx.set(trees.length - 1);
            }
        });

        // Selecting a different section clears the node selection.
        effect(() => {
            this.selectedIdx();
            this.selectedIds.set(new Set());
        });
    }

    ngAfterViewInit(): void {
        this.resizeObserver = new ResizeObserver(() => this.fit());
        this.resizeObserver.observe(this.viewportEl.nativeElement);

        effect(
            () => {
                this.tree();
                this.fit();
            },
            { injector: this.injector },
        );
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
    }

    @HostListener('document:keydown', ['$event'])
    protected onDocumentKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') this.close.emit();
    }

    private fit(): void {
        const t = this.tree();
        const el = this.viewportEl?.nativeElement;
        if (!t || !el) return;
        const pad = 48;
        this.scale.set(Math.min((el.clientWidth - pad) / t.size.w, (el.clientHeight - pad) / t.size.h, 1));
    }

    protected onSelectTree(i: number): void {
        this.selectedIdx.set(i);
    }

    protected onSelect(id: string, multi: boolean): void {
        this.selectedIds.update((prev) => {
            if (multi) return toggleInSet(prev, id);
            return prev.size === 1 && prev.has(id) ? new Set() : new Set([id]);
        });
    }

    protected onSelectNodeEvent(e: { id: string; multi: boolean }): void {
        this.onSelect(e.id, e.multi);
    }

    protected selectAll(): void {
        const t = this.tree();
        if (!t) return;
        const ids = new Set<string>();
        const walk = (n: UiNode) => {
            ids.add(n.id);
            n.children.forEach(walk);
        };
        walk(t);
        this.selectedIds.set(ids);
    }

    protected applyClass(cls: RobloxClass | 'exclude' | 'reset'): void {
        const selected = this.selectedIds();
        if (!selected.size) return;
        if (cls === 'exclude') {
            this.excluded.update((prev) => withAdded(prev, selected));
            this.selectedIds.set(new Set());
        } else if (cls === 'reset') {
            this.overrides.update((prev) => {
                const n = new Map(prev);
                selected.forEach((id) => n.delete(id));
                return n;
            });
            this.excluded.update((prev) => withRemoved(prev, selected));
        } else {
            this.overrides.update((prev) => {
                const n = new Map(prev);
                selected.forEach((id) => n.set(id, cls));
                return n;
            });
        }
    }

    protected toggleExclude(id: string): void {
        this.excluded.update((prev) => toggleInSet(prev, id));
    }

    protected toggleNoStrokeSelected(): void {
        const selected = this.selectedIds();
        this.noStroke.update((prev) => toggleAllInSet(prev, selected));
    }

    protected toggleNoStrokeSingle(): void {
        const n = this.singleNode();
        if (!n) return;
        this.noStroke.update((prev) => toggleInSet(prev, n.id));
    }

    protected patchSingle(patch: Partial<TextPatch>): void {
        const n = this.singleNode();
        if (!n) return;
        this.textPatches.update((prev) => {
            const next = new Map(prev);
            next.set(n.id, { ...prev.get(n.id), ...patch });
            return next;
        });
    }

    protected singleTextColor(): string {
        const n = this.singleNode();
        if (!n) return '#ffffff';
        const patched = this.textPatches().get(n.id)?.color;
        if (patched) return patched;
        const c = n.props.textColor;
        return c ? `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}` : '#ffffff';
    }

    protected singleTextSize(): number {
        const n = this.singleNode();
        if (!n) return 14;
        return this.textPatches().get(n.id)?.size ?? n.props.textSize ?? 14;
    }

    protected singleTextTransparent(): boolean {
        const n = this.singleNode();
        return !!n && !!this.textPatches().get(n.id)?.transparent;
    }

    protected singleNoStroke(): boolean {
        const n = this.singleNode();
        return !!n && this.noStroke().has(n.id);
    }

    protected async send(): Promise<void> {
        const t = this.tree();
        if (!t) return;
        const patched = patchTree(t, this.overrides(), this.excluded(), this.noStroke(), this.textPatches(), this.useFigmaNames());
        if (!patched) return;
        const code = generateLuau(patched, { root: this.rootMode(), mode: this.sizeMode() });
        runtimeEnqueue({ type: 'eval', code }).catch(() => {});
        for (const im of this.images()) {
            const cached = getCachedAsset(im.hash);
            if (cached) {
                runtimeEnqueue({ type: 'eval', code: buildApplyLuau(im.hash, cached) }).catch(() => {});
                continue;
            }
            try {
                const { rgba, w, h } = await pngToRgba(im.png);
                runtimeEnqueue({ type: 'eval', code: buildUploadLuau(rgba, w, h, im.hash) }).catch(() => {});
                await new Promise((r) => setTimeout(r, 250));
            } catch {
                // skip
            }
        }
        this.sent.set(true);
        setTimeout(() => this.sent.set(false), 2000);
    }
}
