import {
    AfterViewInit,
    Component,
    ElementRef,
    Injector,
    OnDestroy,
    ViewChild,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import { invoke, Channel } from '@tauri-apps/api/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ThemeService } from '../core/theme.service';

let counter = 0;

@Component({
    selector: 'app-terminal',
    standalone: true,
    templateUrl: './terminal.component.html',
    styleUrl: './terminal.component.scss',
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
    readonly cwd = input.required<string>();
    readonly close = output<void>();

    @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
    private readonly themeService = inject(ThemeService);
    private readonly injector = inject(Injector);

    private term?: Terminal;
    private observer?: ResizeObserver;
    private id = '';

    ngAfterViewInit(): void {
        const term = new Terminal({
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            cursorBlink: true,
            theme: this.xtermTheme(),
        });
        this.term = term;

        effect(
            () => {
                this.themeService.theme(); // track for re-run
                term.options.theme = this.xtermTheme();
            },
            { injector: this.injector },
        );

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(this.host.nativeElement);
        fit.fit();

        this.id = `term-${counter++}`;
        const output = new Channel<number[]>();
        output.onmessage = (bytes) => term.write(new Uint8Array(bytes));

        invoke('terminal_open', {
            id: this.id,
            cols: term.cols || 80,
            rows: term.rows || 24,
            cwd: this.cwd(),
            output,
        }).catch((e) => term.write(`\r\n[terminal] ${e}\r\n`));

        term.onData((data) => invoke('terminal_write', { id: this.id, data }).catch(() => {}));

        this.observer = new ResizeObserver(() => {
            const el = this.host.nativeElement;
            if (el.clientHeight < 24 || el.clientWidth < 24) return;
            fit.fit();
            invoke('terminal_resize', { id: this.id, cols: term.cols, rows: term.rows }).catch(() => {});
        });
        this.observer.observe(this.host.nativeElement);
    }

    private xtermTheme() {
        return {
            background: this.themeService.readToken('bg-window'),
            foreground: this.themeService.readToken('editor-fg'),
            cursor: this.themeService.readToken('text-bright'),
        };
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
        if (this.id) invoke('terminal_close', { id: this.id }).catch(() => {});
        this.term?.dispose();
    }
}
