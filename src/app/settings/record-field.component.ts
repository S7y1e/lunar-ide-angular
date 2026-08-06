import { Component, OnInit, input, output, signal } from '@angular/core';

type Pair = [string, string];

// Angular port of record-field.tsx. Rows are a local edit buffer seeded once
// from `entries` (not kept in sync afterward) — same as the React version's
// lazy `useState` initializer — so typing a key doesn't get clobbered by the
// object round-tripping through the parent on every keystroke.
@Component({
    selector: 'app-record-field',
    standalone: true,
    templateUrl: './record-field.component.html',
    styleUrl: './list-field.component.scss',
})
export class RecordFieldComponent implements OnInit {
    readonly entries = input.required<Record<string, string>>();
    readonly entriesChange = output<Record<string, string>>();

    protected readonly rows = signal<Pair[]>([]);

    ngOnInit(): void {
        this.rows.set(Object.entries(this.entries()));
    }

    private commit(next: Pair[]): void {
        this.rows.set(next);
        const object: Record<string, string> = {};
        for (const [key, value] of next) {
            if (key) object[key] = value;
        }
        this.entriesChange.emit(object);
    }

    protected setKey(index: number, key: string): void {
        this.commit(this.rows().map((row, i) => (i === index ? [key, row[1]] : row) as Pair));
    }

    protected setVal(index: number, value: string): void {
        this.commit(this.rows().map((row, i) => (i === index ? [row[0], value] : row) as Pair));
    }

    protected remove(index: number): void {
        this.commit(this.rows().filter((_, i) => i !== index));
    }

    protected add(): void {
        this.commit([...this.rows(), ['', '']]);
    }
}
