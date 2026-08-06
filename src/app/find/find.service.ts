import { Injectable, inject, signal } from '@angular/core';
import { join } from '@tauri-apps/api/path';
import { readFileText, writeFileText } from '../core/filesystem';
import { ProjectService } from '../core/project.service';
import { SearchResults, searchProject } from '../core/project-queries';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DEBOUNCE_MS = 200;

// Angular port of use-project-search.ts.
@Injectable({ providedIn: 'root' })
export class FindService {
    private readonly project = inject(ProjectService);
    private timer: ReturnType<typeof setTimeout> | null = null;

    readonly query = signal('');
    readonly caseSensitive = signal(false);
    readonly results = signal<SearchResults | null>(null);
    readonly loading = signal(false);

    setQuery(value: string): void {
        this.query.set(value);
        this.scheduleSearch();
    }

    toggleCaseSensitive(): void {
        this.caseSensitive.update((v) => !v);
        this.scheduleSearch();
    }

    private scheduleSearch(): void {
        if (this.timer) clearTimeout(this.timer);
        const q = this.query().trim();
        if (!q) {
            this.results.set(null);
            this.loading.set(false);
            return;
        }
        this.loading.set(true);
        this.timer = setTimeout(() => {
            searchProject(q, this.caseSensitive())
                .then((r) => this.results.set(r))
                .catch(() => this.results.set(null))
                .finally(() => this.loading.set(false));
        }, DEBOUNCE_MS);
    }

    // Replace every occurrence of the query in the files that matched, then
    // re-search. Returns how many occurrences were replaced.
    async replaceAll(replacement: string): Promise<number> {
        const root = this.project.root();
        const q = this.query().trim();
        const results = this.results();
        if (!root || !q || !results) return 0;

        const files = [...new Set(results.matches.map((m) => m.file))];
        const re = new RegExp(escapeRegExp(q), this.caseSensitive() ? 'g' : 'gi');
        let count = 0;
        for (const file of files) {
            const abs = await join(root, ...file.split(/[\\/]/));
            try {
                const text = await readFileText(abs);
                const hits = text.match(re);
                if (!hits) continue;
                count += hits.length;
                await writeFileText(abs, text.replace(re, replacement));
            } catch {
                // skip files we can't read/write
            }
        }
        this.scheduleSearch();
        return count;
    }
}
