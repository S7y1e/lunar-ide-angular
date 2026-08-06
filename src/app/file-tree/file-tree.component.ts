import { Component, computed, inject, signal } from '@angular/core';
import { FileTreeNodeComponent } from './file-tree-node.component';
import { FileTreeFilteredComponent } from './file-tree-filtered.component';
import { FileNode } from './file-node';
import { ProjectService } from '../core/project.service';
import { baseName } from '../core/path';

// Angular port of file-tree/sidebar.tsx (tool selection is handled one level
// up by ToolWindowComponent, so this only covers what Sidebar renders when
// currentView === "project").
@Component({
    selector: 'app-file-tree',
    standalone: true,
    imports: [FileTreeNodeComponent, FileTreeFilteredComponent],
    templateUrl: './file-tree.component.html',
    styleUrl: './file-tree.component.scss',
})
export class FileTreeComponent {
    protected readonly project = inject(ProjectService);
    protected readonly root = computed<FileNode | null>(() => {
        const path = this.project.root();
        return path ? { name: baseName(path), path, isDir: true } : null;
    });

    protected readonly filter = signal('');
    protected readonly query = computed(() => this.filter().trim());
    protected readonly treeKey = signal(0);

    protected collapseAndRefresh(): void {
        this.treeKey.update((k) => k + 1);
    }
}
