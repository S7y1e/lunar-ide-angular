import { invoke } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

const DEFINITIONS_RESOURCE = 'resources/globalTypes.PluginSecurity.d.luau';

type Prop = { name: string; enumName?: string };
type RawClass = { name: string; extends?: string; props: Prop[]; events: string[] };
type RawEnum = { name: string; members: string[] };
type RawModel = { classes: RawClass[]; enums: RawEnum[]; creatable: string[] };

export type ClassMembers = { props: Prop[]; events: string[] };

export type RobloxModel = {
    creatable: Set<string>;
    membersOf(className: string): ClassMembers | null;
    guiMembers(): ClassMembers;
    enumMembers(enumName: string): string[] | null;
};

let cached: Promise<RobloxModel | null> | null = null;

export function loadRobloxModel(): Promise<RobloxModel | null> {
    if (!cached) cached = build();
    return cached;
}

async function build(): Promise<RobloxModel | null> {
    try {
        const defsPath = await resolveResource(DEFINITIONS_RESOURCE);
        const raw = await invoke<RawModel>('roblox_api', { defsPath });
        const classes = new Map(raw.classes.map((c) => [c.name, c]));
        const enums = new Map(raw.enums.map((e) => [e.name, e.members]));
        const memo = new Map<string, ClassMembers>();

        const membersOf = (className: string): ClassMembers | null => {
            const hit = memo.get(className);
            if (hit) return hit;
            const props: Prop[] = [];
            const events: string[] = [];
            const seen = new Set<string>();
            let cur: string | undefined = className;
            while (cur) {
                const cls: RawClass | undefined = classes.get(cur);
                if (!cls) break;
                for (const p of cls.props) if (!seen.has(p.name)) (seen.add(p.name), props.push(p));
                for (const e of cls.events) if (!seen.has(e)) (seen.add(e), events.push(e));
                cur = cls.extends;
            }
            if (!classes.has(className)) return null;
            const out = { props, events };
            memo.set(className, out);
            return out;
        };

        const isGui = (className: string): boolean => {
            let cur: string | undefined = className;
            while (cur) {
                if (cur === 'GuiObject') return true;
                cur = classes.get(cur)?.extends;
            }
            return false;
        };

        let guiUnion: ClassMembers | null = null;
        const guiMembers = (): ClassMembers => {
            if (guiUnion) return guiUnion;
            const props: Prop[] = [];
            const events: string[] = [];
            const sp = new Set<string>();
            const se = new Set<string>();
            for (const c of raw.classes) {
                if (!isGui(c.name)) continue;
                const m = membersOf(c.name);
                if (!m) continue;
                for (const p of m.props) if (!sp.has(p.name)) (sp.add(p.name), props.push(p));
                for (const e of m.events) if (!se.has(e)) (se.add(e), events.push(e));
            }
            guiUnion = { props, events };
            return guiUnion;
        };

        return {
            creatable: new Set(raw.creatable),
            membersOf,
            guiMembers,
            enumMembers: (n) => enums.get(n) ?? null,
        };
    } catch (e) {
        console.warn('[ui-autocomplete] failed to load Roblox API model', e);
        return null;
    }
}
