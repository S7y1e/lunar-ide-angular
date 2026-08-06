export type SettingType = 'boolean' | 'string' | 'number' | 'string[]' | 'record' | 'keybind';

export type Setting = {
    key: string;
    tool: string;
    category: string;
    label: string;
    type: SettingType;
    default: boolean | string | number | string[] | Record<string, string>;
    description: string;
    enum?: string[];
    enumLabels?: Record<string, string>;
    min?: number;
    max?: number;
};
