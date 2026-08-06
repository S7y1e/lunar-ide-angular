import { Component, computed, inject, signal } from '@angular/core';
import { PackagesService } from './packages.service';
import { Package, PackageKind, packageAdd, packageRemove } from '../core/packages';
import { WallyHit, searchWally } from '../core/wally-search';

const KINDS: { id: PackageKind; label: string }[] = [
    { id: 'shared', label: 'Shared' },
    { id: 'server', label: 'Server' },
    { id: 'dev', label: 'Dev' },
];

@Component({
    selector: 'app-packages-panel',
    standalone: true,
    templateUrl: './packages-panel.component.html',
    styleUrl: './packages-panel.component.scss',
})
export class PackagesPanelComponent {
    protected readonly pkgs = inject(PackagesService);
    protected readonly kinds = KINDS;

    protected readonly spec = signal('');
    protected readonly kind = signal<PackageKind>('shared');
    protected readonly err = signal<string | null>(null);
    protected readonly focused = signal(false);
    protected readonly hits = signal<WallyHit[]>([]);
    protected readonly searching = signal(false);
    protected readonly showHits = computed(() => this.focused() && (this.hits().length > 0 || this.searching()));

    private searchTimer: ReturnType<typeof setTimeout> | null = null;

    protected onSpecInput(value: string): void {
        this.spec.set(value);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        const q = value.trim();
        if (q.includes('@') || q.length < 2) {
            this.hits.set([]);
            this.searching.set(false);
            return;
        }
        this.searching.set(true);
        this.searchTimer = setTimeout(() => {
            searchWally(q)
                .then((r) => this.hits.set(r))
                .catch(() => this.hits.set([]))
                .finally(() => this.searching.set(false));
        }, 250);
    }

    protected onBlur(): void {
        setTimeout(() => this.focused.set(false), 150);
    }

    protected pick(h: WallyHit): void {
        this.spec.set(`${h.scope}/${h.name}@${h.versions[0] ?? ''}`);
        this.focused.set(false);
    }

    protected itemsFor(kind: PackageKind): Package[] {
        return (this.pkgs.list()?.packages ?? []).filter((p) => p.kind === kind);
    }

    protected async add(): Promise<void> {
        const value = this.spec().trim();
        if (!value) return;
        this.err.set(null);
        try {
            await packageAdd(value, this.kind());
            this.spec.set('');
            this.pkgs.refresh();
        } catch (e) {
            this.err.set(String(e));
        }
    }

    protected async remove(p: Package): Promise<void> {
        try {
            await packageRemove(p.alias, p.kind);
            this.pkgs.refresh();
        } catch (e) {
            this.err.set(String(e));
        }
    }
}
