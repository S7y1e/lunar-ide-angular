import { Injectable, signal } from '@angular/core';
import { listen } from '@tauri-apps/api/event';
import { mapFigma } from './map-figma';
import { FigmaNode, UiNode } from './figma-types';
import { FigmaImage } from './upload-image';

// Angular port of the figma://import listener lifted in index.tsx: the Figma
// plugin POSTs { root, images } to the bridge; map it and open the preview.
@Injectable({ providedIn: 'root' })
export class FigmaImportService {
    readonly trees = signal<UiNode[]>([]);
    readonly images = signal<FigmaImage[]>([]);
    readonly open = signal(false);

    constructor() {
        listen<{ root?: FigmaNode; image?: FigmaImage } | FigmaNode>('figma://import', (e) => {
            const payload = e.payload as { root?: FigmaNode; image?: FigmaImage };
            if (payload.image) {
                this.images.update((prev) => [...prev, payload.image!]); // stream in after the tree
                return;
            }
            const root = (payload.root ?? payload) as FigmaNode;
            const t = mapFigma(root);
            if (t) {
                this.trees.update((prev) => [...prev.filter((p) => p.name !== t.name), t]);
                this.open.set(true);
            }
        });
    }

    close(): void {
        this.open.set(false);
    }
}
