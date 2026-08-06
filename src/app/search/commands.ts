export type Command = {
    id: string;
    title: string;
    hint?: string;
    enabled?: boolean;
    run: () => void;
};
