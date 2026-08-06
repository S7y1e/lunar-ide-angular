use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::ProjectStore;

const MAX_MATCHES: usize = 2000;
const MAX_LINE: usize = 400;
const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub matches: Vec<SearchMatch>,
    pub truncated: bool,
}

#[tauri::command]
pub fn project_search(
    store: State<'_, ProjectStore>,
    query: String,
    case_sensitive: bool,
) -> Option<SearchResults> {
    let root = store.0.lock().unwrap().as_ref().map(|m| m.root.clone())?;
    let query = query.trim();
    if query.is_empty() {
        return Some(SearchResults { matches: vec![], truncated: false });
    }
    let needle = if case_sensitive {
        query.to_string()
    } else {
        query.to_lowercase()
    };

    let mut matches = Vec::new();
    let mut truncated = false;
    walk(&root, &root, &needle, case_sensitive, &mut matches, &mut truncated);
    Some(SearchResults { matches, truncated })
}

fn walk(
    root: &Path,
    dir: &Path,
    needle: &str,
    case_sensitive: bool,
    out: &mut Vec<SearchMatch>,
    truncated: &mut bool,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if *truncated {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(root, &path, needle, case_sensitive, out, truncated);
        } else {
            search_file(root, &path, needle, case_sensitive, out, truncated);
        }
    }
}

fn search_file(
    root: &Path,
    file: &Path,
    needle: &str,
    case_sensitive: bool,
    out: &mut Vec<SearchMatch>,
    truncated: &mut bool,
) {
    // read_to_string fails on non-UTF-8 (binary) files, which skips them.
    let content = match std::fs::read_to_string(file) {
        Ok(content) => content,
        Err(_) => return,
    };
    let rel = file
        .strip_prefix(root)
        .unwrap_or(file)
        .to_string_lossy()
        .replace('\\', "/");

    for (i, line) in content.lines().enumerate() {
        let hay = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        if let Some(col) = hay.find(needle) {
            out.push(SearchMatch {
                file: rel.clone(),
                line: (i + 1) as u32,
                column: (col + 1) as u32,
                text: line.chars().take(MAX_LINE).collect(),
            });
            if out.len() >= MAX_MATCHES {
                *truncated = true;
                return;
            }
        }
    }
}
