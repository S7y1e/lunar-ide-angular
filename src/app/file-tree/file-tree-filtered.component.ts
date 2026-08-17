import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { ProjectFile, walkProjectFiles } from '../core/filesystem';
import { FileTreeSelectionService } from './file-tree-selection.service';
import { fileIconFor } from './file-icons';

// Subsequence (fuzzy) match against the relative path, like a command palette.
function fuzzy(needle: string, hay: string): boolean {
    let i = 0;
    for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true;
    return needle.length === 0;
}

// Angular port of file-tree/filtered-tree.tsx.
@Component({
    selector: 'app-file-tree-filtered',
    standalone: true,
    templateUrl: './file-tree-filtered.component.html',
    styleUrl: './file-tree-filtered.component.scss',
})
export class FileTreeFilteredComponent implements OnInit, OnDestroy {
    readonly root = input.required<string>();
    readonly query = input.required<string>();

    protected readonly selection = inject(FileTreeSelectionService);
    protected readonly fileIconFor = fileIconFor;
    private readonly files = signal<ProjectFile[]>([]);
    private active = true;

    protected readonly results = computed(() => {
        const q = this.query().toLowerCase();
        return this.files()
            .filter((f) => fuzzy(q, f.relativePath.toLowerCase()))
            .slice(0, 200);
    });

    ngOnInit(): void {
        walkProjectFiles(this.root())
            .then((f) => this.active && this.files.set(f))
            .catch(() => {});
    }

    ngOnDestroy(): void {
        this.active = false;
    }

    protected open(file: ProjectFile): void {
        this.selection.select(file.path);
        this.selection.openFile(file.path);
    }
}
