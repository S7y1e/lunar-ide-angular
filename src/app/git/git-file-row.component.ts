import { Component, inject, input } from '@angular/core';
import { GitService } from './git.service';
import { type GitFile } from '../core/git';
import { baseName } from '../core/path';
import { EditorGroupsService } from '../core/editor-groups.service';

const STATUS_LABEL: Record<string, string> = {
    M: 'M', A: 'A', D: 'D', R: 'R', C: 'C', '?': 'U', U: '!',
};
const codeClass = (c: string): string =>
    c === '?' ? 'cUnt' : c === 'A' ? 'cAdd' : c === 'D' ? 'cDel' : 'cMod';

@Component({
    selector: 'app-git-file-row',
    standalone: true,
    templateUrl: './git-file-row.component.html',
    styleUrl: './git-file-row.component.scss',
})
export class GitFileRowComponent {
    readonly file = input.required<GitFile>();
    readonly staged = input(false);

    protected readonly git = inject(GitService);
    protected readonly editorGroups = inject(EditorGroupsService);
    protected readonly statusLabel = STATUS_LABEL;
    protected readonly codeClass = codeClass;
    protected readonly baseName = baseName;

    protected code(): string {
        const f = this.file();
        return this.staged() ? f.index : f.work;
    }
}
