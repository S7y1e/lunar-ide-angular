import { GitCommit } from '../core/git';

export type GraphNode = { commit: GitCommit; col: number; lane: number };
export type GraphEdge = {
    fromCol: number;
    fromLane: number;
    toCol: number;
    toLane: number;
    lane: number; // lane used for coloring the edge
};
export type Graph = {
    nodes: GraphNode[];
    edges: GraphEdge[];
    lanes: number;
    cols: number;
};

// Assign each commit a lane (branch row) via the standard git-graph algorithm.
// Input is newest-first (children before parents). Columns are chronological:
// col 0 = newest. Rendered horizontally elsewhere (x=col, y=lane).
export function layoutGraph(commits: GitCommit[]): Graph {
    const colOf = new Map<string, number>();
    commits.forEach((c, i) => colOf.set(c.hash, i));

    const lanes: (string | null)[] = []; // lanes[i] = hash reserved by a child for that lane
    const laneOf = (hash: string) => lanes.findIndex((h) => h === hash);
    const alloc = (hash: string) => {
        let i = lanes.findIndex((h) => h === null);
        if (i === -1) {
            i = lanes.length;
            lanes.push(hash);
        } else lanes[i] = hash;
        return i;
    };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let maxLane = 0;

    commits.forEach((c, col) => {
        let myLane = laneOf(c.hash);
        if (myLane === -1) myLane = alloc(c.hash); // branch tip with no child in view
        lanes[myLane] = null; // free; parents refill below
        nodes.push({ commit: c, col, lane: myLane });
        maxLane = Math.max(maxLane, myLane);

        c.parents.forEach((p, pi) => {
            let pl = laneOf(p);
            if (pl === -1) {
                if (pi === 0 && lanes[myLane] === null) {
                    pl = myLane;
                    lanes[myLane] = p;
                } else pl = alloc(p);
            }
            maxLane = Math.max(maxLane, pl);
            const toCol = colOf.get(p) ?? col + 1; // truncated history → stub off-screen
            edges.push({ fromCol: col, fromLane: myLane, toCol, toLane: pl, lane: pl });
        });
    });

    return { nodes, edges, lanes: maxLane + 1, cols: commits.length };
}

const PALETTE = ['#4f8cff', '#48c78e', '#ff8c42', '#b07cff', '#ff6b9d', '#36c5d0', '#e0c341', '#8c9eff'];
export const laneColor = (lane: number): string => PALETTE[lane % PALETTE.length];
