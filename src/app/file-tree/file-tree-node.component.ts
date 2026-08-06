import {
    Component,
    ElementRef,
    OnInit,
    ViewChild,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { FileNode } from './file-node';
import { createFile, createFolder, deleteEntry, readDirectory, watchDirectory } from '../core/filesystem';
import { canonicalPath } from '../core/monaco-uri';
import { FileTreeSelectionService } from './file-tree-selection.service';
import { FileTreeContextMenuComponent, MenuItem } from './file-tree-context-menu.component';
import { FileTreeNameInputComponent } from './file-tree-name-input.component';

// Angular port of file-tree/file-tree-node.tsx + use-tree-node.ts (merged:
// this codebase folds a React hook straight into the owning component).
@Component({
    selector: 'app-file-tree-node',
    standalone: true,
    imports: [FileTreeNodeComponent, FileTreeContextMenuComponent, FileTreeNameInputComponent],
    templateUrl: './file-tree-node.component.html',
    styleUrl: './file-tree-node.component.scss',
})
export class FileTreeNodeComponent implements OnInit {
    readonly node = input.required<FileNode>();
    readonly depth = input(0);
    readonly defaultExpanded = input(false);
    // True only for the tree root, which was rendered without an owning
    // parent to reload — mirrors React's `onChanged` being undefined there,
    // which is what hid Rename/Delete on the root row.
    readonly isRoot = input(false);
    // Bubbles up when this node's own identity (name/existence) changed, so
    // its parent knows to re-read its directory listing.
    readonly changed = output<void>();

    protected readonly selection = inject(FileTreeSelectionService);

    protected readonly expanded = signal(false);
    protected readonly children = signal<FileNode[]>([]);
    protected readonly menu = signal<{ x: number; y: number } | null>(null);
    protected readonly renaming = signal(false);
    protected readonly creating = signal<'file' | 'folder' | null>(null);

    @ViewChild('row') private rowEl?: ElementRef<HTMLDivElement>;

    protected readonly menuItems = computed<MenuItem[]>(() => [
        ...(this.node().isDir
            ? [
                  { label: 'New File', onClick: () => this.startCreate('file') },
                  { label: 'New Folder', onClick: () => this.startCreate('folder') },
              ]
            : []),
        ...(!this.isRoot()
            ? [
                  { label: 'Rename', onClick: () => this.renaming.set(true) },
                  { label: 'Delete', danger: true, onClick: () => this.remove() },
              ]
            : []),
    ]);

    constructor() {
        // Auto-reveal the active editor file: ancestor folders expand on the
        // way down (each expansion mounts children, cascading the effect),
        // and the matching leaf scrolls into view and highlights.
        effect(() => {
            const revealPath = this.selection.revealPath();
            if (!revealPath) return;
            const here = canonicalPath(this.node().path);
            if (this.node().isDir) {
                if (revealPath.startsWith(here + '\\')) this.expand();
            } else if (here === revealPath) {
                this.selection.select(this.node().path);
                this.rowEl?.nativeElement.scrollIntoView({ block: 'nearest' });
            }
        });

        // Keep the explorer in sync with the disk: while a folder is
        // expanded, watch it so external renames/creates/deletes (Argon,
        // git, another editor) show up automatically.
        effect((onCleanup) => {
            const node = this.node();
            if (!this.expanded() || !node.isDir) return;
            let unwatch: (() => void) | undefined;
            let active = true;
            watchDirectory(node.path, () => {
                readDirectory(node.path)
                    .then((nodes) => this.children.set(nodes))
                    .catch(() => {});
            })
                .then((fn) => {
                    if (active) unwatch = fn;
                    else fn();
                })
                .catch(() => {});
            onCleanup(() => {
                active = false;
                unwatch?.();
            });
        });
    }

    ngOnInit(): void {
        if (this.defaultExpanded() && this.node().isDir) {
            this.expanded.set(true);
            readDirectory(this.node().path).then((nodes) => this.children.set(nodes));
        }
    }

    protected onRowClick(): void {
        this.selection.select(this.node().path);
        this.toggle();
    }

    protected onRowDblClick(): void {
        if (!this.node().isDir) this.selection.openFile(this.node().path);
    }

    protected openMenu(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.menu.set({ x: e.clientX, y: e.clientY });
    }

    private async ensureLoaded(): Promise<void> {
        if (this.children().length === 0) this.children.set(await readDirectory(this.node().path));
    }

    protected async toggle(): Promise<void> {
        if (!this.node().isDir) return;
        if (!this.expanded()) await this.ensureLoaded();
        this.expanded.update((v) => !v);
    }

    protected async expand(): Promise<void> {
        if (!this.node().isDir || this.expanded()) return;
        await this.ensureLoaded();
        this.expanded.set(true);
    }

    protected async reload(): Promise<void> {
        this.children.set(await readDirectory(this.node().path));
    }

    protected async startCreate(kind: 'file' | 'folder'): Promise<void> {
        await this.ensureLoaded();
        this.expanded.set(true);
        this.creating.set(kind);
    }

    protected async submitCreate(name: string): Promise<void> {
        const kind = this.creating();
        const trimmed = name.trim();
        this.creating.set(null);
        if (!trimmed || !kind) return;
        try {
            if (kind === 'folder') await createFolder(this.node().path, trimmed);
            else await createFile(this.node().path, trimmed);
            await this.reload();
        } catch (err) {
            await message(String(err), { title: 'Error', kind: 'error' });
        }
    }

    protected async submitRename(name: string): Promise<void> {
        this.renaming.set(false);
        const trimmed = name.trim();
        if (!trimmed || trimmed === this.node().name) return;
        await this.selection.renameNode(this.node(), trimmed);
        this.changed.emit();
    }

    protected async remove(): Promise<void> {
        const ok = await confirm(`Delete "${this.node().name}"?`, { title: 'Delete', kind: 'warning' });
        if (!ok) return;
        try {
            await deleteEntry(this.node().path, this.node().isDir);
            this.changed.emit();
        } catch (err) {
            await message(String(err), { title: 'Error', kind: 'error' });
        }
    }
}
