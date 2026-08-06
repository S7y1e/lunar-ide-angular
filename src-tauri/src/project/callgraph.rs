use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::lex_util::{
    is_ident_part, is_ident_start, long_bracket_level, read_quoted, skip_long_bracket,
};
use super::ProjectStore;

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];
const SCRIPT_EXT: [&str; 2] = [".luau", ".lua"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallerSite {
    pub caller: String, // enclosing function name (or the file's base name at top level)
    pub file: String,
    pub line: u32,
    pub column: u32,
}

pub(super) enum K {
    Word(String),
    Dot,
    Colon,
    LParen,
    Other,
}

pub(super) struct Tok {
    pub line: u32,
    pub col: u32,
    pub k: K,
}

// Tokenize tracking line/column, reusing lex_util so strings/comments don't
// produce false words.
pub(super) fn scan(src: &str) -> Vec<Tok> {
    let b = src.as_bytes();
    let n = b.len();
    let mut i = 0;
    let mut line: u32 = 1;
    let mut line_start: usize = 0;
    let mut out = Vec::new();

    // advance helper that counts newlines across a skipped region
    macro_rules! jump {
        ($ni:expr) => {{
            let ni = $ni;
            for k in i..ni {
                if b[k] == b'\n' {
                    line += 1;
                    line_start = k + 1;
                }
            }
            i = ni;
        }};
    }

    while i < n {
        let c = b[i];
        let col = (i - line_start) as u32 + 1;
        match c {
            b'\n' => {
                line += 1;
                line_start = i + 1;
                i += 1;
            }
            b' ' | b'\t' | b'\r' => i += 1,
            b'-' if b.get(i + 1) == Some(&b'-') => {
                let after = i + 2;
                if let Some(level) = long_bracket_level(b, after) {
                    jump!(skip_long_bracket(b, after, level));
                } else {
                    let mut j = after;
                    while j < n && b[j] != b'\n' {
                        j += 1;
                    }
                    i = j;
                }
            }
            b'"' | b'\'' => {
                let (_, ni) = read_quoted(b, i, c);
                jump!(ni);
            }
            b'[' if long_bracket_level(b, i).is_some() => {
                let level = long_bracket_level(b, i).unwrap();
                jump!(skip_long_bracket(b, i, level));
            }
            b'.' => {
                out.push(Tok { line, col, k: K::Dot });
                i += 1;
            }
            b':' => {
                out.push(Tok { line, col, k: K::Colon });
                i += 1;
            }
            b'(' => {
                out.push(Tok { line, col, k: K::LParen });
                i += 1;
            }
            _ if is_ident_start(c) => {
                let start = i;
                i += 1;
                while i < n && is_ident_part(b[i]) {
                    i += 1;
                }
                out.push(Tok {
                    line,
                    col,
                    k: K::Word(src[start..i].to_string()),
                });
            }
            _ => {
                out.push(Tok { line, col, k: K::Other });
                i += 1;
            }
        }
    }
    out
}

const OPENERS: [&str; 4] = ["if", "function", "repeat", "do"];

// last segment of a function definition name (a / a.b / a:b), advancing `i`
// past it. None when the function is anonymous.
fn read_def_name(toks: &[Tok], i: &mut usize) -> Option<String> {
    let mut name = match toks.get(*i) {
        Some(Tok { k: K::Word(w), .. }) => {
            *i += 1;
            w.clone()
        }
        _ => return None,
    };
    loop {
        match (toks.get(*i), toks.get(*i + 1)) {
            (Some(Tok { k: K::Dot, .. }), Some(Tok { k: K::Word(w), .. }))
            | (Some(Tok { k: K::Colon, .. }), Some(Tok { k: K::Word(w), .. })) => {
                name = w.clone();
                *i += 2;
            }
            _ => break,
        }
    }
    Some(name)
}

fn base_name(rel: &str) -> String {
    let file = rel.rsplit('/').next().unwrap_or(rel);
    for e in SCRIPT_EXT {
        if let Some(stripped) = file.strip_suffix(e) {
            return stripped.to_string();
        }
    }
    file.to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalleeSite {
    pub callee: String, // function called from within the target
    pub file: String,
    pub line: u32,
    pub column: u32,
}

// Visit every call site in this file, reporting (caller, callee, line, col) to
// `emit`. `caller` is the enclosing function (or the file base name at top
// level); `callee` is the called word (covers `f(`, `.f(`, `:f(`).
fn scan_file(rel: &str, src: &str, emit: &mut dyn FnMut(&str, &str, u32, u32)) {
    let toks = scan(src);
    let top = base_name(rel);
    // (function name, block depth at definition)
    let mut frames: Vec<(String, i32)> = Vec::new();
    let mut depth: i32 = 0;
    let mut expect_loop_do = false;

    let mut i = 0;
    while i < toks.len() {
        if let K::Word(w) = &toks[i].k {
            match w.as_str() {
                "function" => {
                    depth += 1;
                    let mut j = i + 1;
                    let name = read_def_name(&toks, &mut j);
                    if let Some(n) = name {
                        frames.push((n, depth));
                    }
                    i = j;
                    continue;
                }
                "for" | "while" => {
                    depth += 1;
                    expect_loop_do = true;
                }
                "if" => depth += 1,
                "repeat" => depth += 1,
                "do" => {
                    if expect_loop_do {
                        expect_loop_do = false;
                    } else {
                        depth += 1;
                    }
                }
                "until" => depth -= 1,
                "end" => {
                    if let Some((_, d)) = frames.last() {
                        if *d == depth {
                            frames.pop();
                        }
                    }
                    depth -= 1;
                }
                "elseif" | "else" | "then" => {}
                other if !OPENERS.contains(&other) => {
                    if matches!(toks.get(i + 1).map(|t| &t.k), Some(K::LParen)) {
                        let caller = frames.last().map(|(n, _)| n.as_str()).unwrap_or(top.as_str());
                        emit(caller, other, toks[i].line, toks[i].col);
                    }
                }
                _ => {}
            }
        }
        i += 1;
    }
}

fn walk(root: &Path, dir: &Path, emit: &mut dyn FnMut(&str, &str, &str, u32, u32)) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(root, &path, emit);
        } else if SCRIPT_EXT.iter().any(|e| name.ends_with(e)) {
            if let Ok(src) = std::fs::read_to_string(&path) {
                let rel = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                scan_file(&rel, &src, &mut |caller, callee, line, col| {
                    emit(caller, callee, &rel, line, col)
                });
            }
        }
    }
}

fn project_root(store: &State<'_, ProjectStore>, name: &str) -> Option<std::path::PathBuf> {
    if name.trim().is_empty() {
        return None;
    }
    store.0.lock().unwrap().as_ref().map(|m| m.root.clone())
}

#[tauri::command]
pub fn project_callers(store: State<'_, ProjectStore>, name: String) -> Vec<CallerSite> {
    let root = match project_root(&store, &name) {
        Some(r) => r,
        None => return vec![],
    };
    let name = name.trim();
    let mut out = Vec::new();
    walk(&root, &root, &mut |caller, callee, rel, line, column| {
        if callee == name {
            out.push(CallerSite {
                caller: caller.to_string(),
                file: rel.to_string(),
                line,
                column,
            });
        }
    });
    out
}

#[tauri::command]
pub fn project_callees(store: State<'_, ProjectStore>, name: String) -> Vec<CalleeSite> {
    let root = match project_root(&store, &name) {
        Some(r) => r,
        None => return vec![],
    };
    let name = name.trim();
    let mut out = Vec::new();
    walk(&root, &root, &mut |caller, callee, rel, line, column| {
        if caller == name {
            out.push(CalleeSite {
                callee: callee.to_string(),
                file: rel.to_string(),
                line,
                column,
            });
        }
    });
    out
}
