import { Component, computed, input, output } from '@angular/core';
import { GitCommit } from '../core/git';
import { laneColor, layoutGraph } from './lane-layout';

const COLW = 46;
const LANEH = 40;
const PADX = 28;
const PADY = 26;
const R = 6;

type PositionedEdge = { key: number; d: string; color: string };
type PositionedNode = {
    hash: string;
    x: number;
    y: number;
    r: number;
    color: string;
    stroke: string;
    title: string;
    refs: { text: string; x: number; y: number; width: number }[];
};

@Component({
    selector: 'app-git-graph',
    standalone: true,
    templateUrl: './git-graph.component.html',
    styleUrl: './git-graph.component.scss',
})
export class GitGraphComponent {
    readonly commits = input.required<GitCommit[]>();
    readonly selected = input<string | null>(null);
    readonly select = output<string>();

    private readonly graph = computed(() => layoutGraph(this.commits()));

    private readonly xOf = (col: number): number => PADX + (this.graph().cols - 1 - col) * COLW;
    private readonly yOf = (lane: number): number => PADY + lane * LANEH;

    protected readonly width = computed(() => PADX * 2 + this.graph().cols * COLW);
    protected readonly height = computed(() => PADY * 2 + this.graph().lanes * LANEH);

    protected readonly edges = computed<PositionedEdge[]>(() =>
        this.graph().edges.map((e, i) => {
            const x1 = this.xOf(e.fromCol);
            const y1 = this.yOf(e.fromLane);
            const x2 = this.xOf(e.toCol);
            const y2 = this.yOf(e.toLane);
            const mx = (x1 + x2) / 2;
            return { key: i, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, color: laneColor(e.lane) };
        }),
    );

    protected readonly nodes = computed<PositionedNode[]>(() => {
        const selected = this.selected();
        return this.graph().nodes.map((n) => {
            const x = this.xOf(n.col);
            const y = this.yOf(n.lane);
            const active = n.commit.hash === selected;
            return {
                hash: n.commit.hash,
                x,
                y,
                r: active ? R + 2 : R,
                color: laneColor(n.lane),
                stroke: active ? 'var(--text)' : 'var(--bg-window)',
                title: `${n.commit.short} · ${n.commit.subject}`,
                refs: n.commit.refs.slice(0, 2).map((ref, ri) => ({
                    text: ref,
                    x,
                    y: y - 13 - ri * 14,
                    width: ref.length * 6.2 + 8,
                })),
            };
        });
    });
}
