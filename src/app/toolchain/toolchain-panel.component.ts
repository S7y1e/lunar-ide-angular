import { Component, computed, inject, signal } from '@angular/core';
import { ToolchainService } from './toolchain.service';
import { AVAILABLE_TOOLS } from './rokit-tools';
import { VersionPickerComponent } from './version-picker.component';

@Component({
    selector: 'app-toolchain-panel',
    standalone: true,
    imports: [VersionPickerComponent],
    templateUrl: './toolchain-panel.component.html',
    styleUrl: './toolchain-panel.component.scss',
})
export class ToolchainPanelComponent {
    protected readonly tc = inject(ToolchainService);
    protected readonly newTool = signal('');

    protected readonly suggestions = computed(() => {
        const q = this.newTool().trim().toLowerCase();
        if (!q) return [];
        const have = new Set(this.tc.tools().map((t) => t.name.toLowerCase()));
        return AVAILABLE_TOOLS.filter(
            (tool) =>
                !have.has(tool.name.toLowerCase()) &&
                (tool.name.toLowerCase().includes(q) || tool.spec.toLowerCase().includes(q)),
        ).slice(0, 6);
    });

    protected repoOf(spec: string): string {
        const at = spec.lastIndexOf('@');
        return at < 0 ? spec : spec.slice(0, at);
    }

    protected versionOf(spec: string): string {
        const at = spec.lastIndexOf('@');
        return at < 0 ? '' : spec.slice(at + 1);
    }

    protected add(tool: string): void {
        const value = tool.trim();
        if (!value) return;
        this.tc.add(value);
        this.newTool.set('');
    }
}
