use std::path::Path;
use serde::Serialize;
use tauri::State;
use super::ProjectStore;

const TAGS: &[&str] = &["TODO", "FIXME", "HACK", "NOTE", "XXX"];
const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build", ".git"];
const MAX_ITEMS: usize = 2000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub tag: String,
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
}

#[tauri::command]
pub fn project_todos(store: State<'_, ProjectStore>) -> Option<Vec<TodoItem>> {
    let root = store.0.lock().unwrap().as_ref().map(|m| m.root.clone())?;
    let mut out = Vec::new();
    walk(&root, &root, &mut out);
    Some(out)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<TodoItem>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if out.len() >= MAX_ITEMS {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if !name.starts_with('.') && !SKIP_DIRS.contains(&name.as_str()) {
                walk(root, &path, out);
            }
        } else if matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("lua") | Some("luau")
        ) {
            scan_file(root, &path, out);
        }
    }
}

fn scan_file(root: &Path, file: &Path, out: &mut Vec<TodoItem>) {
    let content = match std::fs::read_to_string(file) {
        Ok(c) => c,
        Err(_) => return,
    };
    let rel = file
        .strip_prefix(root)
        .unwrap_or(file)
        .to_string_lossy()
        .replace('\\', "/");

    for (i, line) in content.lines().enumerate() {
        if out.len() >= MAX_ITEMS {
            return;
        }
        // Find `--` comment start
        let Some(comment_start) = line.find("--") else { continue };
        let comment = &line[comment_start + 2..];
        let trimmed = comment.trim_start_matches(['-', ' ', '[', '!']);

        for tag in TAGS {
            if !trimmed.to_uppercase().starts_with(tag) {
                continue;
            }
            let rest = trimmed[tag.len()..].trim_start_matches([':', ' ']);
            let col = line.find("--").unwrap_or(0) as u32 + 1;
            out.push(TodoItem {
                tag: tag.to_string(),
                file: rel.clone(),
                line: (i + 1) as u32,
                column: col,
                text: rest.chars().take(200).collect(),
            });
            break;
        }
    }
}
