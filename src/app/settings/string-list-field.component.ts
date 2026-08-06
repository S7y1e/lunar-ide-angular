import { Component, input, output } from '@angular/core';

// Angular port of string-list-field.tsx.
@Component({
    selector: 'app-string-list-field',
    standalone: true,
    templateUrl: './string-list-field.component.html',
    styleUrl: './list-field.component.scss',
})
export class StringListFieldComponent {
    readonly values = input.required<string[]>();
    readonly valuesChange = output<string[]>();

    protected update(index: number, value: string): void {
        this.valuesChange.emit(this.values().map((v, i) => (i === index ? value : v)));
    }

    protected remove(index: number): void {
        this.valuesChange.emit(this.values().filter((_, i) => i !== index));
    }

    protected add(): void {
        this.valuesChange.emit([...this.values(), '']);
    }
}
