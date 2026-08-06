import { Component, computed, output, signal } from '@angular/core';
import { FolderTemplate, NewProjectOptions } from '../core/new-project';

type TemplateOption = { id: FolderTemplate; label: string; description: string };

const TEMPLATES: TemplateOption[] = [
    { id: 'game', label: 'Game', description: 'Shared, Server, and Client' },
    { id: 'place', label: 'Place', description: 'A folder for every service' },
    { id: 'plugin', label: 'Plugin', description: 'A buildable plugin source' },
];

type ToolKey = 'wally' | 'stylua' | 'selene';

const TOOLS: { id: ToolKey; label: string; description: string }[] = [
    { id: 'wally', label: 'Wally', description: 'Package manager' },
    { id: 'stylua', label: 'StyLua', description: 'Code formatter' },
    { id: 'selene', label: 'Selene', description: 'Linter' },
];

@Component({
    selector: 'app-new-project-dialog',
    standalone: true,
    templateUrl: './new-project-dialog.component.html',
    styleUrl: './new-project-dialog.component.scss',
})
export class NewProjectDialogComponent {
    readonly create = output<NewProjectOptions>();
    readonly cancel = output<void>();

    protected readonly templates = TEMPLATES;
    protected readonly tools = TOOLS;

    protected readonly name = signal('');
    protected readonly template = signal<FolderTemplate>('game');
    protected readonly toolState = signal<Record<ToolKey, boolean>>({ wally: true, stylua: true, selene: false });

    protected readonly valid = computed(() => this.name().trim().length > 0);

    protected toggleTool(key: ToolKey): void {
        this.toolState.update((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    protected onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter') this.submit();
        else if (e.key === 'Escape') this.cancel.emit();
    }

    protected submit(): void {
        if (!this.valid()) return;
        const tools = this.toolState();
        this.create.emit({
            name: this.name().trim(),
            template: this.template(),
            wally: tools.wally,
            stylua: tools.stylua,
            selene: tools.selene,
        });
    }
}
