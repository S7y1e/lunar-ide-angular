use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::callgraph::{scan, Tok, K};
use super::dependencies::{collect_locals, index_maps, is_vendored};
use super::luau_lex::lex;
use super::{DataModelNode, ProjectStore};

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];
const SCRIPT_EXT: [&str; 2] = [".luau", ".lua"];
const MAX: usize = 1000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Symbol {
    pub name: String,
    pub container: String, // module/table prefix, or the file base name
    pub file: String,
    pub line: u32,
    pub column: u32,
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

// Collect function definitions: `function a.b.c(`, `function a:b(`,
// `local function n(`, `function n(`. Records the last name segment + its
// container (the prefix, or the file base name).
fn collect_defs(rel: &str, src: &str, q: &str, out: &mut Vec<Symbol>) {
    let toks = scan(src);
    let top = base_name(rel);
    let mut i = 0;
    while i < toks.len() {
        let is_fn = matches!(&toks[i].k, K::Word(w) if w == "function");
        if !is_fn {
            i += 1;
            continue;
        }
        // read the name chain after `function`
        let mut j = i + 1;
        let mut container = top.clone();
        let (mut name, mut line, mut col) = match toks.get(j) {
            Some(Tok { k: K::Word(w), line, col }) => {
                j += 1;
                (w.clone(), *line, *col)
            }
            _ => {
                i += 1;
                continue;
            }
        };
        loop {
            match (toks.get(j), toks.get(j + 1)) {
                (Some(Tok { k: K::Dot, .. }), Some(Tok { k: K::Word(w), line: l, col: c }))
                | (Some(Tok { k: K::Colon, .. }), Some(Tok { k: K::Word(w), line: l, col: c })) => {
                    container = name;
                    name = w.clone();
                    line = *l;
                    col = *c;
                    j += 2;
                }
                _ => break,
            }
        }
        if q.is_empty() || name.to_lowercase().contains(q) {
            out.push(Symbol {
                name,
                container,
                file: rel.to_string(),
                line,
                column: col,
            });
        }
        i = j;
    }
}

fn walk(root: &Path, dir: &Path, q: &str, out: &mut Vec<Symbol>) {
    if out.len() >= MAX {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if out.len() >= MAX {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(root, &path, q, out);
        } else if SCRIPT_EXT.iter().any(|e| name.ends_with(e)) {
            if let Ok(src) = std::fs::read_to_string(&path) {
                let rel = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                collect_defs(&rel, &src, q, out);
            }
        }
    }
}

#[tauri::command]
pub fn project_symbols(store: State<'_, ProjectStore>, query: String) -> Vec<Symbol> {
    let root = match store.0.lock().unwrap().as_ref().map(|m| m.root.clone()) {
        Some(r) => r,
        None => return vec![],
    };
    let q = query.trim().to_lowercase();
    let mut out = Vec::new();
    walk(&root, &root, &q, &mut out);
    out
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
    pub call: bool,
}

struct Ctx {
    by_chain: HashMap<Vec<String>, String>,
    file_to_chain: HashMap<String, Vec<String>>,
    root_name: String,
    services: HashSet<String>,
}

// Which module file a single receiver identifier refers to, within `file`.
fn resolve_receiver(root: &Path, file: &str, receiver: &str, ctx: &Ctx) -> Option<String> {
    if receiver.is_empty() || receiver == "script" {
        return Some(file.to_string());
    }
    let chain = ctx.file_to_chain.get(file)?;
    let content = std::fs::read_to_string(root.join(file)).ok()?;
    let locals = collect_locals(&lex(&content), chain, &ctx.root_name, &ctx.services);
    locals.get(receiver).and_then(|c| ctx.by_chain.get(c).cloned())
}

// Precise project-wide usages of `module`.`member` — every `Z.member` /
// `Z:member` where Z resolves (via require) to the same module file.
#[tauri::command]
pub fn project_member_usages(
    store: State<'_, ProjectStore>,
    from_file: String,
    receiver: String,
    member: String,
) -> Vec<Usage> {
    let (root, project_file) = match store.0.lock().unwrap().as_ref() {
        Some(m) => (m.root.clone(), m.project_file.clone()),
        None => return vec![],
    };
    let tree: DataModelNode = match super::sourcemap::generate(&root, &project_file) {
        Some(t) => t,
        None => return vec![],
    };
    let (by_chain, file_to_chain, root_name, services) = index_maps(&tree);
    let ctx = Ctx { by_chain, file_to_chain, root_name, services };

    let module = resolve_receiver(&root, &from_file, &receiver, &ctx).unwrap_or(from_file);

    let mut out = Vec::new();
    walk_usages(&root, &root, &member, &module, &ctx, &mut out);
    out
}

fn walk_usages(
    root: &Path,
    dir: &Path,
    member: &str,
    module: &str,
    ctx: &Ctx,
    out: &mut Vec<Usage>,
) {
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
            walk_usages(root, &path, member, module, ctx, out);
        } else if SCRIPT_EXT.iter().any(|e| name.ends_with(e)) {
            let rel = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            if is_vendored(&rel) {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                scan_usages(&rel, &content, member, module, ctx, out);
            }
        }
    }
}

fn scan_usages(
    rel: &str,
    content: &str,
    member: &str,
    module: &str,
    ctx: &Ctx,
    out: &mut Vec<Usage>,
) {
    let chain = match ctx.file_to_chain.get(rel) {
        Some(c) => c,
        None => return,
    };
    let locals = collect_locals(&lex(content), chain, &ctx.root_name, &ctx.services);
    let toks = scan(content);
    let lines: Vec<&str> = content.lines().collect();

    for i in 2..toks.len() {
        let Tok { k: K::Word(m), line, col } = &toks[i] else {
            continue;
        };
        if m != member || !matches!(toks[i - 1].k, K::Dot | K::Colon) {
            continue;
        }
        let K::Word(recv) = &toks[i - 2].k else {
            continue;
        };
        // skip the definition site `function Z.member`
        if i >= 3 && matches!(&toks[i - 3].k, K::Word(w) if w == "function") {
            continue;
        }
        let target = if recv == "script" {
            Some(rel.to_string())
        } else {
            locals.get(recv).and_then(|c| ctx.by_chain.get(c).cloned())
        };
        if target.as_deref() != Some(module) {
            continue;
        }
        let text = lines
            .get((*line as usize).saturating_sub(1))
            .map(|l| l.trim().chars().take(200).collect::<String>())
            .unwrap_or_default();
        out.push(Usage {
            file: rel.to_string(),
            line: *line,
            column: *col,
            text,
            call: matches!(toks.get(i + 1).map(|t| &t.k), Some(K::LParen)),
        });
    }
}
