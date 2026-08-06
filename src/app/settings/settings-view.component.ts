import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, computed, inject, output, signal } from '@angular/core';
import { SettingsService } from '../core/settings.service';
import { Setting } from './setting';
import { ALL_SETTINGS, settingsNav } from './registry';
import { CATEGORY_BLURB, toolOrder, categoryOrder } from './settings-meta';
import { SettingsFieldComponent } from './settings-field.component';
import { SettingsOverviewComponent } from './settings-overview.component';

type Section = { id: string; tool: string; category: string; settings: Setting[] };

function matchesQuery(setting: Setting, q: string): boolean {
    return (
        setting.key.toLowerCase().includes(q) ||
        setting.label.toLowerCase().includes(q) ||
        setting.description.toLowerCase().includes(q)
    );
}

function sectionsOf(settings: Setting[]): Section[] {
    const sections: Section[] = [];
    for (const setting of settings) {
        const id = `${setting.tool}::${setting.category}`;
        let section = sections.find((s) => s.id === id);
        if (!section) {
            section = { id, tool: setting.tool, category: setting.category, settings: [] };
            sections.push(section);
        }
        section.settings.push(setting);
    }
    sections.sort(
        (a, b) =>
            toolOrder(a.tool) - toolOrder(b.tool) ||
            categoryOrder(a.tool, a.category) - categoryOrder(b.tool, b.category) ||
            a.category.localeCompare(b.category),
    );
    return sections;
}

// Angular port of settings-view.tsx: the full registry-driven Settings
// screen (search, tool/category nav, overview cards, generic field
// rendering) — replaces the earlier hand-rolled Appearance/Editor/
// Keybindings-only form now that the Setting registry (registry.ts) exists.
@Component({
    selector: 'app-settings-view',
    standalone: true,
    imports: [SettingsFieldComponent, SettingsOverviewComponent],
    templateUrl: './settings-view.component.html',
    styleUrl: './settings-view.component.scss',
})
export class SettingsViewComponent implements AfterViewInit {
    protected readonly settings = inject(SettingsService);
    readonly close = output<void>();

    protected readonly query = signal('');
    protected readonly selected = signal<string | null>(null);
    protected readonly categoryBlurb = CATEGORY_BLURB;

    protected readonly nav = settingsNav();

    @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

    private readonly trimmedQuery = computed(() => this.query().trim().toLowerCase());
    protected readonly showOverview = computed(() => this.selected() === null && this.trimmedQuery() === '');

    protected readonly sections = computed(() => {
        const selected = this.selected();
        const q = this.trimmedQuery();
        const visible = ALL_SETTINGS.filter((setting) => {
            if (selected && `${setting.tool}::${setting.category}` !== selected) return false;
            return !q || matchesQuery(setting, q);
        });
        return sectionsOf(visible);
    });

    ngAfterViewInit(): void {
        this.searchInput?.nativeElement.focus();
    }

    @HostListener('document:keydown.escape')
    protected onEscape(): void {
        this.close.emit();
    }

    protected valueOf(setting: Setting): unknown {
        const values = this.settings.values();
        return setting.key in values ? values[setting.key] : setting.default;
    }

    protected isModified(setting: Setting): boolean {
        return setting.key in this.settings.values();
    }
}
