import { Component, input, output, signal } from '@angular/core';

type Release = { tag_name: string };

@Component({
    selector: 'app-version-picker',
    standalone: true,
    templateUrl: './version-picker.component.html',
    styleUrl: './version-picker.component.scss',
})
export class VersionPickerComponent {
    readonly repo = input.required<string>();
    readonly current = input('');
    readonly disabled = input(false);
    readonly pickVersion = output<string>();

    protected readonly open = signal(false);
    protected readonly versions = signal<string[] | null>(null);
    protected readonly loading = signal(false);

    protected async toggle(): Promise<void> {
        if (this.open()) {
            this.open.set(false);
            return;
        }
        this.open.set(true);
        if (this.versions() !== null || this.loading()) return;
        this.loading.set(true);
        try {
            const res = await fetch(`https://api.github.com/repos/${this.repo()}/releases?per_page=30`);
            if (!res.ok) throw new Error();
            const data: Release[] = await res.json();
            this.versions.set(data.map((r) => r.tag_name.replace(/^v/, '')));
        } catch {
            this.versions.set([]);
        }
        this.loading.set(false);
    }

    protected pick(version: string): void {
        this.open.set(false);
        this.pickVersion.emit(version);
    }
}
