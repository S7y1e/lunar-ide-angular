import { Component, WritableSignal, signal } from '@angular/core';

const SNIPPET = `-- adjust the path to wherever you placed the module:
local LunarInspect = require(game.ReplicatedStorage.Shared.LunarInspect)

-- watch any table you own:
LunarInspect.watch("PlayerManager.players", players)`;

@Component({
    selector: 'app-state-guide',
    standalone: true,
    templateUrl: './state-guide.component.html',
    styleUrl: './state-guide.component.scss',
})
export class StateGuideComponent {
    protected readonly snippet = SNIPPET;
    protected readonly sdkCopied = signal(false);
    protected readonly snippetCopied = signal(false);
    private sdkSource: string | null = null;

    protected async copySdk(): Promise<void> {
        let source: string = this.sdkSource ?? '';
        if (!source) {
            source = await fetch('/lunar-inspect.lua').then((r) => r.text());
            this.sdkSource = source;
        }
        await navigator.clipboard?.writeText(source);
        this.flash(this.sdkCopied);
    }

    protected async copySnippet(): Promise<void> {
        await navigator.clipboard?.writeText(SNIPPET);
        this.flash(this.snippetCopied);
    }

    private flash(signalRef: WritableSignal<boolean>): void {
        signalRef.set(true);
        setTimeout(() => signalRef.set(false), 1400);
    }
}
