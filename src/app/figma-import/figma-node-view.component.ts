import { Component, input } from '@angular/core';
import { isTextClass, isImageClass, UiNode, RobloxClass } from './figma-types';

export interface TextPatch {
    color?: string;
    size?: number;
    transparent?: boolean;
}

export interface SelectCtx {
    selected: Set<string>;
    excluded: Set<string>;
    overrides: Map<string, RobloxClass>;
    noStroke: Set<string>;
    textPatches: Map<string, TextPatch>;
    images: Map<string, string>; // hash -> data:image/png;base64,...
    onSelect: (id: string, multi: boolean) => void;
}

const gradientStops = (stops: { color: number[]; pos: number }[]): string =>
    stops.map((s) => `rgb(${s.color.join(',')}) ${Math.round(s.pos * 100)}%`).join(', ');

@Component({
    selector: 'app-figma-node-view',
    standalone: true,
    imports: [FigmaNodeViewComponent],
    templateUrl: './figma-node-view.component.html',
    styleUrl: './figma-node-view.component.scss',
})
export class FigmaNodeViewComponent {
    readonly n = input.required<UiNode>();
    readonly ctx = input<SelectCtx>();

    protected cls(): RobloxClass {
        return this.ctx()?.overrides.get(this.n().id) ?? this.n().className;
    }

    protected isText(): boolean {
        return isTextClass(this.cls());
    }

    protected isExcluded(): boolean {
        return this.ctx()?.excluded.has(this.n().id) ?? false;
    }

    protected isSelected(): boolean {
        return this.ctx()?.selected.has(this.n().id) ?? false;
    }

    protected nodeClass(): string {
        const n = this.n();
        const cls = this.cls();
        const p = n.props;
        const imgSrc = this.imageSrc();
        return [
            isImageClass(cls) && p.hasImageFill && !imgSrc ? 'placeholder' : '',
            this.isSelected() ? 'nodeSelected' : '',
        ]
            .filter(Boolean)
            .join(' ');
    }

    protected imageSrc(): string | undefined {
        const n = this.n();
        const cls = this.cls();
        return isImageClass(cls) && n.props.imageHash ? this.ctx()?.images.get(n.props.imageHash) : undefined;
    }

    protected style(): string {
        const n = this.n();
        const ctx = this.ctx();
        const cls = this.cls();
        const text = this.isText();
        const p = n.props;
        const excluded = this.isExcluded();

        const decls: string[] = [
            `left: ${n.pos.x}px`,
            `top: ${n.pos.y}px`,
            `width: ${n.size.w}px`,
            `height: ${n.size.h}px`,
        ];
        if (p.cornerRadii) decls.push(`border-radius: ${p.cornerRadii.map((r) => `${r}px`).join(' ')}`);
        else if (p.cornerRadius) decls.push(`border-radius: ${p.cornerRadius}px`);
        if (p.clipsDescendants) decls.push(`overflow: hidden`);
        if (excluded) decls.push(`opacity: 0.25`);

        if (!text && p.backgroundColor) {
            const a = p.backgroundTransparency !== undefined ? 1 - p.backgroundTransparency : 1;
            decls.push(`background: rgba(${p.backgroundColor.join(', ')}, ${a})`);
        }
        if (!text && p.gradient) {
            decls.push(`background: linear-gradient(${p.gradient.rotation + 90}deg, ${gradientStops(p.gradient.stops)})`);
        }

        const noStroke = ctx?.noStroke.has(n.id) ?? false;
        if (p.stroke && !noStroke && p.stroke.color) {
            decls.push(`border: ${p.stroke.thickness}px solid rgb(${p.stroke.color.join(', ')})`);
        } else if (p.stroke && !noStroke && p.stroke.gradient) {
            decls.push(`border-width: ${p.stroke.thickness}px`);
            decls.push(`border-style: solid`);
            decls.push(
                `border-image: linear-gradient(${p.stroke.gradient.rotation + 90}deg, ${gradientStops(p.stroke.gradient.stops)}) 1`,
            );
        }

        const imgSrc = this.imageSrc();
        if (imgSrc) {
            decls.push(`background-image: url(${imgSrc})`);
            decls.push(`background-size: cover`);
            decls.push(`background-position: center`);
        }

        return decls.join('; ');
    }

    protected textStyle(): string {
        const n = this.n();
        const ctx = this.ctx();
        const tp = ctx?.textPatches.get(n.id);
        const p = n.props;
        const decls: string[] = [];
        const color = tp?.color ?? (p.textColor ? `rgb(${p.textColor.join(',')})` : undefined);
        if (color) decls.push(`color: ${color}`);
        const size = tp?.size ?? p.textSize;
        if (size) decls.push(`font-size: ${size}px`);
        if (tp?.transparent) decls.push(`opacity: 0`);
        const justify = p.textXAlign === 'Center' ? 'center' : p.textXAlign === 'Right' ? 'flex-end' : 'flex-start';
        decls.push(`justify-content: ${justify}`);
        return decls.join('; ');
    }

    protected onClick(e: MouseEvent): void {
        const ctx = this.ctx();
        if (!ctx) return;
        e.stopPropagation();
        ctx.onSelect(this.n().id, e.shiftKey || e.metaKey || e.ctrlKey);
    }
}
