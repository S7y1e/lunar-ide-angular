use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::luau_lex::{lex_spanned, parse_chain, ChainArg, Tok};
use super::{DataModelNode, ProjectStore};

const SCRIPT_EXT: [&str; 2] = [".luau", ".lua"];
const VENDORED: [&str; 5] = ["Packages", "ServerPackages", "DevPackages", "_Index", "node_modules"];

pub(super) fn is_vendored(path: &str) -> bool {
    path.split('/').any(|seg| VENDORED.contains(&seg))
}

#[derive(Debug, Clone, Serialize)]
pub struct DependencyEdge {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UnresolvedRequire {
    pub from: String,
    pub expr: String,
    pub line: u32,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DependencyGraph {
    pub edges: Vec<DependencyEdge>,
    pub unresolved: Vec<UnresolvedRequire>,
}

#[tauri::command]
pub fn project_dependencies(store: State<'_, ProjectStore>) -> Option<DependencyGraph> {
    // Generate the model in-memory rather than reading sourcemap.json off disk:
    // the disk file is written lazily by the DataModel watcher, so reading it
    // here raced the write and left the graph empty on a fresh open.
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref()?;
        (m.root.clone(), m.project_file.clone())
    };
    let tree = super::sourcemap::generate(&root, &project_file)?;
    Some(build(&root, &tree))
}

pub(super) fn script_file(node: &DataModelNode) -> Option<String> {
    node.file_paths
        .iter()
        .map(|p| p.replace('\\', "/"))
        .find(|p| SCRIPT_EXT.iter().any(|e| p.ends_with(e)))
}

fn collect(
    node: &DataModelNode,
    chain: &mut Vec<String>,
    by_chain: &mut HashMap<Vec<String>, String>,
    file_to_chain: &mut HashMap<String, Vec<String>>,
) {
    chain.push(node.name.clone());
    if let Some(file) = script_file(node) {
        by_chain.insert(chain.clone(), file.clone());
        file_to_chain.insert(file, chain.clone());
    }
    for child in &node.children {
        collect(child, chain, by_chain, file_to_chain);
    }
    chain.pop();
}

// Resolution maps the index reuses: chain->file, file->chain, the DataModel
// name, and the set of service names (direct children of the root).
pub(super) fn index_maps(
    tree: &DataModelNode,
) -> (
    HashMap<Vec<String>, String>,
    HashMap<String, Vec<String>>,
    String,
    HashSet<String>,
) {
    let root_name = tree.name.clone();
    let services = tree.children.iter().map(|c| c.name.clone()).collect();
    let mut by_chain = HashMap::new();
    let mut file_to_chain = HashMap::new();
    collect(tree, &mut Vec::new(), &mut by_chain, &mut file_to_chain);
    (by_chain, file_to_chain, root_name, services)
}

pub fn build(root: &Path, tree: &DataModelNode) -> DependencyGraph {
    let root_name = tree.name.clone();
    let services: HashSet<String> = tree.children.iter().map(|c| c.name.clone()).collect();

    let mut by_chain = HashMap::new();
    let mut file_to_chain = HashMap::new();
    collect(tree, &mut Vec::new(), &mut by_chain, &mut file_to_chain);

    let mut seen: HashSet<(String, String)> = HashSet::new();
    let mut edges = Vec::new();
    let mut unresolved = Vec::new();

    for (file, chain) in &file_to_chain {
        if is_vendored(file) {
            continue;
        }
        let content = match std::fs::read_to_string(root.join(file)) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let spanned = lex_spanned(&content);
        let tokens: Vec<Tok> = spanned.iter().map(|t| t.kind.clone()).collect();
        let locals = collect_locals(&tokens, chain, &root_name, &services);
        let starts = line_starts(&content);

        for i in 0..tokens.len() {
            let Tok::Ident(name) = &tokens[i] else { continue };
            if name != "require" || tokens.get(i + 1) != Some(&Tok::LParen) {
                continue;
            }
            let Some(arg) = parse_chain(&tokens, i + 2) else { continue };
            let line = line_at(&starts, spanned[i].start);
            match arg {
                ChainArg::Str(s) => unresolved.push(UnresolvedRequire {
                    from: file.clone(),
                    expr: format!("\"{s}\""),
                    line,
                }),
                ChainArg::Path(segs) => {
                    let target =
                        resolve(&segs, Some(chain), &root_name, &services, &locals);
                    match target.and_then(|c| by_chain.get(&c).cloned()) {
                        Some(to) if &to != file => {
                            if seen.insert((file.clone(), to.clone())) {
                                edges.push(DependencyEdge {
                                    from: file.clone(),
                                    to,
                                });
                            }
                        }
                        Some(_) => {}
                        None => unresolved.push(UnresolvedRequire {
                            from: file.clone(),
                            expr: segs.join("."),
                            line,
                        }),
                    }
                }
            }
        }
    }

    DependencyGraph { edges, unresolved }
}

pub(super) fn resolve(
    segs: &[String],
    current: Option<&Vec<String>>,
    root_name: &str,
    services: &HashSet<String>,
    locals: &HashMap<String, Vec<String>>,
) -> Option<Vec<String>> {
    let head = segs.first()?;
    let mut chain = match head.as_str() {
        "script" => current?.clone(),
        "game" => vec![root_name.to_string()],
        name if services.contains(name) => vec![root_name.to_string(), name.to_string()],
        name if locals.contains_key(name) => locals[name].clone(),
        _ => return None,
    };

    for seg in &segs[1..] {
        if seg == "Parent" {
            chain.pop();
            if chain.is_empty() {
                return None;
            }
        } else {
            chain.push(seg.clone());
        }
    }
    Some(chain)
}

pub(super) fn collect_locals(
    tokens: &[Tok],
    current: &Vec<String>,
    root_name: &str,
    services: &HashSet<String>,
) -> HashMap<String, Vec<String>> {
    let mut locals: HashMap<String, Vec<String>> = HashMap::new();
    for i in 0..tokens.len() {
        if tokens[i] != Tok::Local {
            continue;
        }
        let (Some(Tok::Ident(name)), Some(Tok::Equal)) =
            (tokens.get(i + 1), tokens.get(i + 2))
        else {
            continue;
        };
        if let Some(ChainArg::Path(segs)) = parse_chain(tokens, i + 3) {
            if let Some(chain) = resolve(&segs, Some(current), root_name, services, &locals) {
                locals.insert(name.clone(), chain);
            }
        }
    }
    locals
}

fn line_starts(content: &str) -> Vec<usize> {
    let mut v = vec![0usize];
    for (i, b) in content.bytes().enumerate() {
        if b == b'\n' {
            v.push(i + 1);
        }
    }
    v
}

// 1-based line containing byte offset `off`.
fn line_at(starts: &[usize], off: usize) -> u32 {
    starts.partition_point(|&s| s <= off) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_at_finds_the_require_line() {
        // the earlier require_line heuristic mis-attributed this to line 1 because
        // "Shared" also appears in the MathTest path there.
        let src = "local M = require(\"@game/ReplicatedStorage/Shared/MathTest\")\n\
                   local Shared = game:GetService(\"X\")\n\
                   local H = require(Shared:WaitForChild(\"Hello\"))\n";
        let starts = line_starts(src);
        let off = src.rfind("require").unwrap();
        assert_eq!(line_at(&starts, off), 3);
    }
}
