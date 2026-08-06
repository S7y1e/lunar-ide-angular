import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { memberUsages, projectRequirers, Usage } from '../core/project-queries';
import { EditorNavigationService } from '../code-editor/editor-navigation.service';

@Injectable({ providedIn: 'root' })
export class UsagesService {
    private readonly navigation = inject(EditorNavigationService);

    readonly usages = signal<Usage[] | null>(null);
    readonly loading = signal(false);

    readonly target = this.navigation.usageTarget;
    readonly isRequirers = computed(() => this.target()?.kind === 'requirers');
    readonly member = computed(() => {
        const t = this.target();
        return t && 'member' in t ? t.member : undefined;
    });

    private generation = 0;

    constructor() {
        effect(() => {
            const target = this.target();
            const token = ++this.generation;
            if (!target) {
                this.usages.set(null);
                return;
            }
            this.loading.set(true);
            const fetch =
                target.kind === 'requirers'
                    ? projectRequirers(target.file).then((files) =>
                          files.map<Usage>((f) => ({ file: f, line: 1, column: 1, text: f, call: false })),
                      )
                    : memberUsages(target.fromFile, target.receiver, target.member);
            fetch
                .then((u) => {
                    if (token === this.generation) this.usages.set(u);
                })
                .catch(() => {
                    if (token === this.generation) this.usages.set([]);
                })
                .finally(() => {
                    if (token === this.generation) this.loading.set(false);
                });
        });
    }
}
