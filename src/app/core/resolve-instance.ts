import { DataModelNode } from './project-queries';
import { scriptPath } from './instance-path';

// At runtime Roblox clones the Starter* containers into each player, so a
// play-test path points at the runtime copy, not the source. Map it back to
// the container the sourcemap actually owns before traversing.
function mapRuntimeContainers(segments: string[]): string[] {
    if (segments[0] === 'Players' && segments.length >= 3) {
        const rest = segments.slice(3);
        switch (segments[2]) {
            case 'PlayerScripts':
                return ['StarterPlayer', 'StarterPlayerScripts', ...rest];
            case 'PlayerGui':
                return ['StarterGui', ...rest];
            case 'Backpack':
                return ['StarterPack', ...rest];
            case 'Character':
                return ['StarterPlayer', 'StarterCharacterScripts', ...rest];
        }
    }
    return segments;
}

// Maps a Studio instance path (e.g. "ServerScriptService.main", optionally
// "game."-prefixed) to the relative source file the sourcemap owns, or null.
export function makeResolver(tree: DataModelNode | null): (dotPath: string) => string | null {
    return (dotPath: string) => {
        if (!tree) return null;
        let segments = dotPath.split('.');
        if (segments[0] === 'game') segments = segments.slice(1);
        segments = mapRuntimeContainers(segments);
        if (segments.length === 0) return null;

        // Match greedily: an instance name can itself contain dots, so at each
        // level try the longest run of remaining segments that names a child
        // before falling back to shorter.
        let node: DataModelNode = tree;
        let i = 0;
        while (i < segments.length) {
            let matched = false;
            for (let take = segments.length - i; take >= 1; take--) {
                const name = segments.slice(i, i + take).join('.');
                const child = node.children?.find((c) => c.name === name);
                if (child) {
                    node = child;
                    i += take;
                    matched = true;
                    break;
                }
            }
            if (!matched) return null;
        }
        return scriptPath(node);
    };
}
