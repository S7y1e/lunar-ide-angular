import { AfterViewInit, Component, ElementRef, ViewChild, input, output } from '@angular/core';

// Angular port of file-tree/name-input.tsx.
@Component({
    selector: 'app-file-tree-name-input',
    standalone: true,
    templateUrl: './file-tree-name-input.component.html',
    styleUrl: './file-tree-name-input.component.scss',
})
export class FileTreeNameInputComponent implements AfterViewInit {
    readonly initial = input('');
    readonly submitted = output<string>();
    readonly cancelled = output<void>();

    @ViewChild('input', { static: true }) private inputEl!: ElementRef<HTMLInputElement>;

    ngAfterViewInit(): void {
        this.inputEl.nativeElement.focus();
        this.inputEl.nativeElement.select();
    }

    protected onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter') this.submitted.emit(this.inputEl.nativeElement.value);
        else if (e.key === 'Escape') this.cancelled.emit();
    }
}
