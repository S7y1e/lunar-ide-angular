export type HighlightSegments = { pre: string; match: string; post: string } | null;

// Port of search/highlight.tsx as a pure function — the component just
// renders {{ pre }}<mark>{{ match }}</mark>{{ post }} or the plain text.
export function highlightSegments(text: string, query: string): HighlightSegments {
    if (!query) return null;
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return null;
    return { pre: text.slice(0, i), match: text.slice(i, i + query.length), post: text.slice(i + query.length) };
}
