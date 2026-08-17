// Normalize to LF before the text ever reaches Monaco. Argon rewrites files
// with CRLF on Windows; if that reaches the editor the model and luau-lsp
// disagree on column counts ("end character > line length" semantic-token
// errors) and highlighting/features break. Keeping the buffer LF-only makes
// the editor and the language server agree no matter how Argon stores it.
export const toLf = (s: string): string => s.replace(/\r\n/g, '\n');

// Compare ignoring line-ending and trailing-newline differences. Argon
// round-trips a saved file back to disk (push to Studio, then rewrite),
// usually only normalizing EOLs. Without this, our own save would look like
// an external change and prompt the user to reload their own edit.
export const sameText = (a: string, b: string): boolean =>
    a.replace(/\r\n/g, '\n').replace(/\n+$/, '') === b.replace(/\r\n/g, '\n').replace(/\n+$/, '');
