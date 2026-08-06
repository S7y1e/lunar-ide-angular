use std::collections::{BTreeMap, HashMap};

use serde::Serialize;
use tauri::State;

use super::dependencies::{collect_locals, index_maps, is_vendored, resolve};
use super::insights::count_word;
use super::luau_lex::{lex_spanned, parse_chain_at, ChainArg, Tok};
use super::ProjectStore;

// Files that statically require `file`, via the owned dependency graph.
#[tauri::command]
pub fn project_requirers(store: State<'_, ProjectStore>, file: String) -> Vec<String> {
    let Some((root, project_file)) = ({
        let guard = store.0.lock().unwrap();
        guard.as_ref().map(|m| (m.root.clone(), m.project_file.clone()))
    }) else {
        return Vec::new();
    };
    let Some(tree) = super::sourcemap::generate(&root, &project_file) else {
        return Vec::new();
    };
    let mut out: Vec<String> = super::dependencies::build(&root, &tree)
        .edges
        .into_iter()
        .filter(|e| e.to == file)
        .map(|e| e.from)
        .collect();
    out.sort();
    out.dedup();
    out
}

// alias of a `local Alias = require(...)` line, else None.
fn require_alias(line: &str) -> Option<&str> {
    let rest = line.trim_start().strip_prefix("local ")?;
    let (lhs, rhs) = rest.split_once('=')?;
    let alias = lhs.trim();
    let ok = !alias.is_empty()
        && !alias.contains(',')
        && alias.chars().all(|c| c == '_' || c.is_ascii_alphanumeric())
        && rhs.trim_start().starts_with("require");
    ok.then_some(alias)
}

// Sort each contiguous run of `local X = require(...)` lines by alias. Returns the
// new file text if anything moved, else None. Adjacent-only keeps it safe.
fn organize(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut out: Vec<&str> = Vec::with_capacity(lines.len());
    let mut changed = false;
    let mut i = 0;
    while i < lines.len() {
        if require_alias(lines[i]).is_some() {
            let mut j = i;
            while j < lines.len() && require_alias(lines[j]).is_some() {
                j += 1;
            }
            let mut group: Vec<&str> = lines[i..j].to_vec();
            let original = group.clone();
            group.sort_by_key(|l| require_alias(l).unwrap_or("").to_lowercase());
            if group != original {
                changed = true;
            }
            out.extend(group);
            i = j;
        } else {
            out.push(lines[i]);
            i += 1;
        }
    }
    if !changed {
        return None;
    }
    let mut text = out.join("\n");
    if content.ends_with('\n') {
        text.push('\n');
    }
    Some(text)
}

// Returns the reorganized file text (caller applies it as a model edit), or None
// if requires were already sorted.
#[tauri::command]
pub fn project_organize_requires(
    store: State<'_, ProjectStore>,
    file: String,
) -> Result<Option<String>, String> {
    let root = store.root().ok_or("No project open")?;
    let content = std::fs::read_to_string(root.join(&file)).map_err(|e| e.to_string())?;
    Ok(organize(&content))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameEdit {
    pub file: String,
    pub line: usize,
    pub before: String,
    pub after: String,
}

fn line_of(line_starts: &[usize], off: usize) -> usize {
    line_starts.partition_point(|&s| s <= off) - 1
}

// Fold byte-span replacements into line-level before/after edits over `content`.
fn line_edits(content: &str, file: &str, reps: Vec<(usize, usize, String)>) -> Vec<RenameEdit> {
    if reps.is_empty() {
        return Vec::new();
    }
    let mut line_starts = vec![0usize];
    for (idx, b) in content.bytes().enumerate() {
        if b == b'\n' {
            line_starts.push(idx + 1);
        }
    }
    let lines: Vec<&str> = content.split('\n').collect();
    let mut by_line: BTreeMap<usize, Vec<(usize, usize, String)>> = BTreeMap::new();
    for (s, e, rep) in reps {
        by_line.entry(line_of(&line_starts, s)).or_default().push((s, e, rep));
    }
    let mut out = Vec::new();
    for (li, mut group) in by_line {
        let raw = lines.get(li).copied().unwrap_or("");
        let before = raw.strip_suffix('\r').unwrap_or(raw).to_string();
        let base = line_starts[li];
        group.sort_by(|a, b| b.0.cmp(&a.0));
        let mut after = raw.to_string();
        for (s, e, rep) in &group {
            after.replace_range((s - base)..(e - base), rep);
        }
        let after = after.strip_suffix('\r').unwrap_or(&after).to_string();
        out.push(RenameEdit {
            file: file.to_string(),
            line: li + 1,
            before,
            after,
        });
    }
    out
}

// Precise cross-file edits to rename module `file` to `new_name`: require chains
// that resolve to it (via the owned dep graph) plus `:WaitForChild`/
// `:FindFirstChild` string literals naming it. Returns line-level edits; the
// caller previews/applies them, then renames the file. Replaces the old
// word-boundary regex pass, which hit false positives and broke init folders.
#[tauri::command]
pub fn project_rename_edits(
    store: State<'_, ProjectStore>,
    file: String,
    new_name: String,
) -> Result<Vec<RenameEdit>, String> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref().ok_or("No project open")?;
        (m.root.clone(), m.project_file.clone())
    };
    let file = file.replace('\\', "/");
    let tree = super::sourcemap::generate(&root, &project_file).ok_or("No sourcemap")?;
    let (_, file_to_chain, root_name, services) = index_maps(&tree);
    let old_chain = file_to_chain.get(&file).cloned().ok_or("File not in model")?;
    let old_name = old_chain.last().cloned().ok_or("Module has no name")?;
    if old_name == new_name {
        return Ok(Vec::new());
    }

    let mut edits = Vec::new();
    for (rfile, rchain) in &file_to_chain {
        if rfile == &file || is_vendored(rfile) {
            continue;
        }
        let content = match std::fs::read_to_string(root.join(rfile)) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let spanned = lex_spanned(&content);
        let plain: Vec<Tok> = spanned.iter().map(|t| t.kind.clone()).collect();
        let locals = collect_locals(&plain, rchain, &root_name, &services);

        // (byte start, byte end, replacement) on the renamed instance's name.
        let mut reps: Vec<(usize, usize, String)> = Vec::new();
        for i in 0..plain.len() {
            match &plain[i] {
                Tok::Ident(n)
                    if n == "require" && plain.get(i + 1) == Some(&Tok::LParen) =>
                {
                    if let Some((ChainArg::Path(segs), end)) = parse_chain_at(&plain, i + 2) {
                        let hit = resolve(&segs, Some(rchain), &root_name, &services, &locals)
                            .as_ref()
                            == Some(&old_chain);
                        if hit {
                            if let Some(tok) = spanned.get(end - 1) {
                                match &tok.kind {
                                    // dotted form: require(a.b.Old)
                                    Tok::Ident(idn) if idn == &old_name => {
                                        reps.push((tok.start, tok.end, new_name.clone()));
                                    }
                                    // string form: require("@game/.../Old") — rewrite the
                                    // trailing path segment inside the literal only.
                                    Tok::Str(_) => {
                                        if let Some(ns) = tok.end.checked_sub(1 + old_name.len()) {
                                            if content.get(ns..tok.end - 1) == Some(old_name.as_str()) {
                                                reps.push((ns, tok.end - 1, new_name.clone()));
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
                Tok::Ident(m)
                    if (m == "WaitForChild" || m == "FindFirstChild")
                        && i > 0
                        && plain[i - 1] == Tok::Colon
                        && plain.get(i + 1) == Some(&Tok::LParen) =>
                {
                    if let (Some(Tok::Str(s)), Some(st)) = (plain.get(i + 2), spanned.get(i + 2)) {
                        if s == &old_name && st.end > st.start + 2 {
                            reps.push((st.start + 1, st.end - 1, new_name.clone()));
                        }
                    }
                }
                _ => {}
            }
        }
        edits.extend(line_edits(&content, rfile, reps));
    }
    edits.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    Ok(edits)
}

const SUFFIXES: [&str; 6] = [
    ".server.luau",
    ".client.luau",
    ".server.lua",
    ".client.lua",
    ".luau",
    ".lua",
];

fn module_base_name(base: &str) -> Option<String> {
    SUFFIXES
        .iter()
        .find_map(|s| base.strip_suffix(s).map(str::to_string))
}

fn is_ident_str(s: &str) -> bool {
    let mut c = s.chars();
    matches!(c.next(), Some(ch) if ch == '_' || ch.is_ascii_alphabetic())
        && s.chars().all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

// Render a resolved chain ([root, "ReplicatedStorage", ...]) as a require arg.
// Dotted (`game.ReplicatedStorage.Foo`) unless a segment isn't an identifier or
// the original used the @game string form.
fn render_path(chain: &[String], as_str: bool) -> String {
    let segs = &chain[1.min(chain.len())..];
    if as_str || !segs.iter().all(|s| is_ident_str(s)) {
        let mut s = String::from("\"@game");
        for seg in segs {
            s.push('/');
            s.push_str(seg);
        }
        s.push('"');
        s
    } else {
        let mut s = String::from("game");
        for seg in segs {
            s.push('.');
            s.push_str(seg);
        }
        s
    }
}

// Destination directory whose instance chain we look up, plus the module's new
// instance name. For `Foo/init.luau` the module IS the folder `Foo`.
fn split_dest(new_file: &str) -> Option<(String, String)> {
    let (dir, base) = match new_file.rsplit_once('/') {
        Some((d, b)) => (d.to_string(), b.to_string()),
        None => (String::new(), new_file.to_string()),
    };
    let name = module_base_name(&base)?;
    if name == "init" {
        match dir.rsplit_once('/') {
            Some((p, d)) => Some((p.to_string(), d.to_string())),
            None => Some((String::new(), dir)),
        }
    } else {
        Some((dir, name))
    }
}

// Map each directory to the instance chain it represents, learned from existing
// files (an `init` file folder maps to its own full chain).
fn build_dir_map(file_to_chain: &HashMap<String, Vec<String>>) -> HashMap<String, Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for (f, c) in file_to_chain {
        let (dir, base) = match f.rsplit_once('/') {
            Some((d, b)) => (d.to_string(), b),
            None => (String::new(), f.as_str()),
        };
        let is_init = module_base_name(base).as_deref() == Some("init");
        let chain = if is_init {
            c.clone()
        } else {
            c[..c.len().saturating_sub(1)].to_vec()
        };
        map.entry(dir).or_insert(chain);
    }
    map
}

// Chain for `dir`: a direct hit, else the longest known ancestor extended by the
// remaining (assumed-folder) path segments.
fn dir_chain(map: &HashMap<String, Vec<String>>, dir: &str) -> Option<Vec<String>> {
    if let Some(c) = map.get(dir) {
        return Some(c.clone());
    }
    let mut best: Option<(&str, &Vec<String>)> = None;
    for (d, c) in map {
        let ancestor = d.is_empty() || dir.starts_with(&format!("{d}/"));
        if ancestor && best.map_or(true, |(bd, _)| d.len() > bd.len()) {
            best = Some((d, c));
        }
    }
    let (bd, bc) = best?;
    let mut chain = bc.clone();
    let rest = if bd.is_empty() { dir } else { &dir[bd.len() + 1..] };
    if !rest.is_empty() {
        chain.extend(rest.split('/').map(str::to_string));
    }
    Some(chain)
}

// Precise cross-file edits to move module `file` to `new_file`: rewrites every
// require chain that resolves to it (in dependents) to the destination's
// game-rooted path, and rewrites the moved file's own requires whose meaning
// would otherwise change once it sits at the new location. The caller previews/
// applies the edits, then moves the file on disk.
#[tauri::command]
pub fn project_move_edits(
    store: State<'_, ProjectStore>,
    file: String,
    new_file: String,
) -> Result<Vec<RenameEdit>, String> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref().ok_or("No project open")?;
        (m.root.clone(), m.project_file.clone())
    };
    let file = file.replace('\\', "/");
    let new_file = new_file.replace('\\', "/");
    let tree = super::sourcemap::generate(&root, &project_file).ok_or("No sourcemap")?;
    let (_, file_to_chain, root_name, services) = index_maps(&tree);
    let old_chain = file_to_chain.get(&file).cloned().ok_or("File not in model")?;

    let (dest_dir, new_name) = split_dest(&new_file).ok_or("Destination is not a module")?;
    let dir_map = build_dir_map(&file_to_chain);
    let mut new_chain = dir_chain(&dir_map, &dest_dir).ok_or("Can't locate destination in model")?;
    new_chain.push(new_name);
    if new_chain == old_chain {
        return Ok(Vec::new());
    }

    let chain_arg = |spanned: &[super::luau_lex::Token], i: usize, target: &[String]| {
        let plain: Vec<Tok> = spanned.iter().map(|t| t.kind.clone()).collect();
        let (ChainArg::Path(_), end) = parse_chain_at(&plain, i + 2)? else {
            return None;
        };
        let (st, en) = (spanned.get(i + 2)?, spanned.get(end - 1)?);
        let as_str = matches!(en.kind, Tok::Str(_));
        Some((st.start, en.end, render_path(target, as_str)))
    };

    let mut edits = Vec::new();
    for (rfile, rchain) in &file_to_chain {
        if rfile == &file || is_vendored(rfile) {
            continue;
        }
        let content = match std::fs::read_to_string(root.join(rfile)) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let spanned = lex_spanned(&content);
        let plain: Vec<Tok> = spanned.iter().map(|t| t.kind.clone()).collect();
        let locals = collect_locals(&plain, rchain, &root_name, &services);
        let mut reps = Vec::new();
        for i in 0..plain.len() {
            let Tok::Ident(n) = &plain[i] else { continue };
            if n != "require" || plain.get(i + 1) != Some(&Tok::LParen) {
                continue;
            }
            if let Some((ChainArg::Path(segs), _)) = parse_chain_at(&plain, i + 2) {
                if resolve(&segs, Some(rchain), &root_name, &services, &locals).as_ref()
                    == Some(&old_chain)
                {
                    if let Some(rep) = chain_arg(&spanned, i, &new_chain) {
                        reps.push(rep);
                    }
                }
            }
        }
        edits.extend(line_edits(&content, rfile, reps));
    }

    // The moved file's own requires: any whose resolution depends on its position
    // (script-relative) would silently retarget after the move — pin them to the
    // absolute path of what they resolve to today.
    if let Ok(content) = std::fs::read_to_string(root.join(&file)) {
        let spanned = lex_spanned(&content);
        let plain: Vec<Tok> = spanned.iter().map(|t| t.kind.clone()).collect();
        let locals_old = collect_locals(&plain, &old_chain, &root_name, &services);
        let locals_new = collect_locals(&plain, &new_chain, &root_name, &services);
        let mut reps = Vec::new();
        for i in 0..plain.len() {
            let Tok::Ident(n) = &plain[i] else { continue };
            if n != "require" || plain.get(i + 1) != Some(&Tok::LParen) {
                continue;
            }
            if let Some((ChainArg::Path(segs), _)) = parse_chain_at(&plain, i + 2) {
                let old = resolve(&segs, Some(&old_chain), &root_name, &services, &locals_old);
                let new = resolve(&segs, Some(&new_chain), &root_name, &services, &locals_new);
                if let Some(t) = old {
                    if Some(&t) != new.as_ref() {
                        if let Some(rep) = chain_arg(&spanned, i, &t) {
                            reps.push(rep);
                        }
                    }
                }
            }
        }
        edits.extend(line_edits(&content, &file, reps));
    }

    edits.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    Ok(edits)
}

// Top-of-file import block: drop requires whose alias is unused and sort the
// whole block by alias (beyond organize_requires' adjacent-only runs). Bails if a
// comment is interleaved so attached comments never detach. Returns new text or
// None when nothing changed.
fn organize_imports(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut start = 0;
    while start < lines.len() {
        let t = lines[start].trim_start();
        if t.is_empty() || t.starts_with("--") {
            start += 1;
        } else {
            break;
        }
    }
    let mut end = start;
    let mut has_req = false;
    while end < lines.len() {
        if require_alias(lines[end]).is_some() {
            has_req = true;
            end += 1;
        } else if lines[end].trim().is_empty() {
            end += 1;
        } else {
            break;
        }
    }
    if !has_req {
        return None;
    }

    let block = &lines[start..end];
    let mut kept: Vec<&str> = block
        .iter()
        .copied()
        .filter(|l| match require_alias(l) {
            Some(a) => count_word(content, a) > 1,
            None => false,
        })
        .collect();
    let original: Vec<&str> = block
        .iter()
        .copied()
        .filter(|l| require_alias(l).is_some())
        .collect();
    kept.sort_by_key(|l| require_alias(l).unwrap_or("").to_lowercase());

    // trailing blank lines inside the block (separator before following code)
    let tail = block.iter().rev().take_while(|l| l.trim().is_empty()).count();
    if kept == original && tail == block.len() - original.len() {
        return None;
    }

    let mut out: Vec<&str> = lines[..start].to_vec();
    out.extend(kept);
    for _ in 0..tail {
        out.push("");
    }
    out.extend(lines[end..].iter().copied());
    let mut text = out.join("\n");
    if content.ends_with('\n') {
        text.push('\n');
    }
    Some(text)
}

// Reorganized text (caller applies as a model edit), or None if already tidy.
#[tauri::command]
pub fn project_organize_imports(
    store: State<'_, ProjectStore>,
    file: String,
) -> Result<Option<String>, String> {
    let root = store.root().ok_or("No project open")?;
    let content = std::fs::read_to_string(root.join(&file)).map_err(|e| e.to_string())?;
    Ok(organize_imports(&content))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_of_maps_offsets() {
        let starts = vec![0usize, 6, 12]; // "abcde\nfghij\n..."
        assert_eq!(line_of(&starts, 0), 0);
        assert_eq!(line_of(&starts, 5), 0);
        assert_eq!(line_of(&starts, 6), 1);
        assert_eq!(line_of(&starts, 11), 1);
        assert_eq!(line_of(&starts, 12), 2);
    }

    #[test]
    fn sorts_adjacent_requires() {
        let src = "local Zoo = require(a)\nlocal Ant = require(b)\nlocal x = 1\n";
        let out = organize(src).expect("should change");
        assert!(out.starts_with("local Ant = require(b)\nlocal Zoo = require(a)\n"));
        assert!(out.ends_with("local x = 1\n"));
    }

    #[test]
    fn leaves_sorted_untouched() {
        let src = "local Ant = require(b)\nlocal Zoo = require(a)\n";
        assert!(organize(src).is_none());
    }

    #[test]
    fn groups_break_on_blank_lines() {
        // each require is its own group → nothing to reorder
        let src = "local Zoo = require(a)\n\nlocal Ant = require(b)\n";
        assert!(organize(src).is_none());
    }

    fn chain(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn renders_dotted_and_string_paths() {
        let c = chain(&["game", "ReplicatedStorage", "Foo", "Bar"]);
        assert_eq!(render_path(&c, false), "game.ReplicatedStorage.Foo.Bar");
        assert_eq!(render_path(&c, true), "\"@game/ReplicatedStorage/Foo/Bar\"");
        // non-identifier segment forces the string form
        let weird = chain(&["game", "ReplicatedStorage", "My Folder"]);
        assert_eq!(render_path(&weird, false), "\"@game/ReplicatedStorage/My Folder\"");
    }

    #[test]
    fn split_dest_handles_modules_and_init() {
        assert_eq!(
            split_dest("src/shared/Foo.luau"),
            Some(("src/shared".to_string(), "Foo".to_string()))
        );
        assert_eq!(
            split_dest("src/shared/Foo/init.luau"),
            Some(("src/shared".to_string(), "Foo".to_string()))
        );
        assert_eq!(split_dest("src/shared/data.json"), None);
    }

    #[test]
    fn dir_chain_extends_known_ancestor() {
        let mut f2c: HashMap<String, Vec<String>> = HashMap::new();
        f2c.insert("src/Mod.luau".into(), chain(&["game", "ReplicatedStorage", "Mod"]));
        let map = build_dir_map(&f2c);
        assert_eq!(dir_chain(&map, "src"), Some(chain(&["game", "ReplicatedStorage"])));
        // new nested folder under a known dir → append folder names
        assert_eq!(
            dir_chain(&map, "src/util/sub"),
            Some(chain(&["game", "ReplicatedStorage", "util", "sub"]))
        );
    }

    #[test]
    fn build_dir_map_treats_init_folder_as_module() {
        let mut f2c: HashMap<String, Vec<String>> = HashMap::new();
        f2c.insert(
            "src/Comp/init.luau".into(),
            chain(&["game", "ReplicatedStorage", "Comp"]),
        );
        let map = build_dir_map(&f2c);
        assert_eq!(map.get("src/Comp"), Some(&chain(&["game", "ReplicatedStorage", "Comp"])));
    }

    #[test]
    fn organize_imports_drops_unused_and_sorts() {
        let src = "local Zoo = require(a)\nlocal Ant = require(b)\n\nreturn Ant\n";
        let out = organize_imports(src).expect("should change");
        assert_eq!(out, "local Ant = require(b)\n\nreturn Ant\n");
    }

    #[test]
    fn organize_imports_keeps_used_sorted_block() {
        let src = "local Ant = require(a)\nlocal Zoo = require(b)\nreturn Ant + Zoo\n";
        assert!(organize_imports(src).is_none());
    }

    #[test]
    fn organize_imports_skips_header_comment() {
        let src = "--!strict\nlocal Zoo = require(a)\nlocal Ant = require(b)\nreturn Ant + Zoo\n";
        let out = organize_imports(src).expect("should change");
        assert_eq!(out, "--!strict\nlocal Ant = require(b)\nlocal Zoo = require(a)\nreturn Ant + Zoo\n");
    }
}
