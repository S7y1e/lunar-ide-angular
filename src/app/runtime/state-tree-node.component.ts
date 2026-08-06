import { Component, input, output } from '@angular/core';
import { ChangeKind, JsonValue } from './state-diff';

const isObj = (v: JsonValue): v is { [k: string]: JsonValue } =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const branch = (v: JsonValue) => Array.isArray(v) || isObj(v);

const entries = (v: JsonValue): [string, JsonValue][] => {
    if (Array.isArray(v)) return v.map((x, i) => [String(i), x]);
    if (isObj(v)) return Object.keys(v).map((k) => [k, v[k]]);
    return [];
};

const preview = (v: JsonValue): string => {
    if (Array.isArray(v)) return `[${v.length}]`;
    if (isObj(v)) return `{${Object.keys(v).length}}`;
    if (typeof v === 'string') return `"${v}"`;
    return String(v);
};

const valueClass = (v: JsonValue): string => {
    if (typeof v === 'number') return 'num';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'boolean' || v === null) return 'lit';
    return '';
};

@Component({
    selector: 'app-state-tree-node',
    standalone: true,
    imports: [StateTreeNodeComponent],
    templateUrl: './state-tree-node.component.html',
    styleUrl: './state-tree-node.component.scss',
})
export class StateTreeNodeComponent {
    readonly label = input.required<string>();
    readonly value = input.required<JsonValue>();
    readonly path = input.required<string>();
    readonly depth = input.required<number>();
    readonly seq = input.required<number>();
    readonly changes = input.required<Map<string, ChangeKind>>();
    readonly expanded = input.required<Set<string>>();
    readonly toggle = output<string>();

    protected readonly branch = branch;
    protected readonly entries = entries;
    protected readonly preview = preview;
    protected readonly valueClass = valueClass;

    protected open(): boolean {
        return this.expanded().has(this.path());
    }

    protected hasChildren(): boolean {
        return branch(this.value()) && entries(this.value()).length > 0;
    }

    protected kind(): ChangeKind | undefined {
        return this.changes().get(this.path());
    }

    protected childPath(key: string): string {
        const p = this.path();
        return p ? `${p}.${key}` : key;
    }

    protected onRowClick(): void {
        if (this.hasChildren()) this.toggle.emit(this.path());
    }
}
