use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::State;

use super::{run_shell, ProjectStore, TestRun};

const WALLY_TOML: &str = "wally.toml";
const WALLY_LOCK: &str = "wally.lock";

const KINDS: [(&str, &str); 3] = [
    ("shared", "dependencies"),
    ("server", "server-dependencies"),
    ("dev", "dev-dependencies"),
];

fn section_of(kind: &str) -> &str {
    KINDS.iter().find(|(k, _)| *k == kind).map(|(_, s)| *s).unwrap_or("dependencies")
}

#[derive(Debug, Default, Deserialize)]
struct WallyToml {
    #[serde(default)]
    dependencies: HashMap<String, String>,
    #[serde(default, rename = "server-dependencies")]
    server_dependencies: HashMap<String, String>,
    #[serde(default, rename = "dev-dependencies")]
    dev_dependencies: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct WallyLock {
    #[serde(default, rename = "package")]
    packages: Vec<LockPackage>,
}

#[derive(Debug, Deserialize)]
struct LockPackage {
    name: String,
    version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Package {
    pub alias: String,
    pub name: String,        // "scope/name"
    pub version_req: String, // declared version constraint
    pub locked: Option<String>,
    pub kind: String, // shared | server | dev
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageList {
    pub has_wally: bool,
    pub locked: bool,
    pub packages: Vec<Package>,
}

fn split_spec(spec: &str) -> (String, String) {
    match spec.rsplit_once('@') {
        Some((name, ver)) => (name.to_string(), ver.to_string()),
        None => (spec.to_string(), String::new()),
    }
}

#[tauri::command]
pub fn project_packages(store: State<'_, ProjectStore>) -> PackageList {
    let Some(root) = store.root() else {
        return PackageList::default();
    };
    let Ok(text) = std::fs::read_to_string(root.join(WALLY_TOML)) else {
        return PackageList::default();
    };
    let manifest: WallyToml = toml::from_str(&text).unwrap_or_default();

    // name -> locked version, from wally.lock if present.
    let lock: HashMap<String, String> = std::fs::read_to_string(root.join(WALLY_LOCK))
        .ok()
        .and_then(|t| toml::from_str::<WallyLock>(&t).ok())
        .map(|l| l.packages.into_iter().map(|p| (p.name, p.version)).collect())
        .unwrap_or_default();
    let locked = !lock.is_empty();

    let mut packages = Vec::new();
    for (kind, table) in [
        ("shared", &manifest.dependencies),
        ("server", &manifest.server_dependencies),
        ("dev", &manifest.dev_dependencies),
    ] {
        for (alias, spec) in table {
            let (name, version_req) = split_spec(spec);
            packages.push(Package {
                alias: alias.clone(),
                locked: lock.get(&name).cloned(),
                name,
                version_req,
                kind: kind.to_string(),
            });
        }
    }
    packages.sort_by(|a, b| a.alias.to_lowercase().cmp(&b.alias.to_lowercase()));

    PackageList { has_wally: true, locked, packages }
}

// Insert/replace `alias = "spec"` under [section], creating the section if absent.
// Manual text edit keeps the file's comments and ordering intact.
fn upsert_line(text: &str, section: &str, alias: &str, spec: &str) -> String {
    let entry = format!("{alias} = \"{spec}\"");
    let mut out: Vec<String> = Vec::new();
    let mut in_section = false;
    let mut wrote = false;
    let mut found_section = false;

    for line in text.lines() {
        let trimmed = line.trim();
        let is_header = trimmed.starts_with('[') && trimmed.ends_with(']');
        if in_section && (is_header || trimmed.is_empty()) && !wrote {
            // flush the new/updated entry at the end of the section block
            out.push(entry.clone());
            wrote = true;
        }
        if is_header {
            in_section = trimmed == format!("[{section}]");
            if in_section {
                found_section = true;
            }
        }
        // drop an existing line for the same alias inside our section
        if in_section && is_alias_line(trimmed, alias) {
            continue;
        }
        out.push(line.to_string());
    }
    if in_section && !wrote {
        out.push(entry.clone());
    }
    if !found_section {
        if !out.is_empty() && !out.last().map(|l| l.is_empty()).unwrap_or(true) {
            out.push(String::new());
        }
        out.push(format!("[{section}]"));
        out.push(entry);
    }
    let mut joined = out.join("\n");
    joined.push('\n');
    joined
}

fn is_alias_line(trimmed: &str, alias: &str) -> bool {
    trimmed
        .split_once('=')
        .map(|(k, _)| k.trim() == alias)
        .unwrap_or(false)
}

fn remove_line(text: &str, section: &str, alias: &str) -> String {
    let mut out = Vec::new();
    let mut in_section = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_section = trimmed == format!("[{section}]");
        }
        if in_section && is_alias_line(trimmed, alias) {
            continue;
        }
        out.push(line.to_string());
    }
    let mut joined = out.join("\n");
    joined.push('\n');
    joined
}

fn derive_alias(name: &str) -> String {
    let leaf = name.rsplit('/').next().unwrap_or(name);
    let mut chars = leaf.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => leaf.to_string(),
    }
}

fn write_toml(root: &Path, text: String) -> Result<(), String> {
    std::fs::write(root.join(WALLY_TOML), text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn package_add(
    store: State<'_, ProjectStore>,
    spec: String,
    kind: String,
) -> Result<(), String> {
    let root = store.root().ok_or("No project open")?;
    // spec: "alias=scope/name@ver" or "scope/name@ver"
    let (alias, dep) = match spec.split_once('=') {
        Some((a, d)) => (a.trim().to_string(), d.trim().to_string()),
        None => {
            let (name, _) = split_spec(&spec);
            (derive_alias(&name), spec.trim().to_string())
        }
    };
    if !dep.contains('@') {
        return Err("Specify a version: scope/name@version".into());
    }
    let text = std::fs::read_to_string(root.join(WALLY_TOML))
        .map_err(|_| "No wally.toml — run `wally init` first")?;
    write_toml(&root, upsert_line(&text, section_of(&kind), &alias, &dep))
}

#[tauri::command]
pub fn package_remove(
    store: State<'_, ProjectStore>,
    alias: String,
    kind: String,
) -> Result<(), String> {
    let root = store.root().ok_or("No project open")?;
    let text = std::fs::read_to_string(root.join(WALLY_TOML)).map_err(|e| e.to_string())?;
    write_toml(&root, remove_line(&text, section_of(&kind), &alias))
}

#[tauri::command]
pub fn wally_install(store: State<'_, ProjectStore>) -> Result<TestRun, String> {
    let root = store.root().ok_or("No project open")?;
    run_shell(&root, "wally install")
}

#[tauri::command]
pub fn wally_update(store: State<'_, ProjectStore>) -> Result<TestRun, String> {
    let root = store.root().ok_or("No project open")?;
    run_shell(&root, "wally update")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_under_existing_section() {
        let src = "[dependencies]\nRoact = \"roblox/roact@1.4.2\"\n";
        let out = upsert_line(src, "dependencies", "Signal", "sleitnick/signal@1.5.0");
        assert!(out.contains("Signal = \"sleitnick/signal@1.5.0\""));
        assert!(out.contains("Roact = \"roblox/roact@1.4.2\""));
    }

    #[test]
    fn creates_missing_section() {
        let src = "[dependencies]\nRoact = \"roblox/roact@1.4.2\"\n";
        let out = upsert_line(src, "dev-dependencies", "TestEZ", "roblox/testez@0.4.1");
        assert!(out.contains("[dev-dependencies]"));
        assert!(out.contains("TestEZ = \"roblox/testez@0.4.1\""));
    }

    #[test]
    fn replaces_and_removes() {
        let src = "[dependencies]\nSignal = \"a/signal@1.0.0\"\n";
        let bumped = upsert_line(src, "dependencies", "Signal", "a/signal@2.0.0");
        assert!(bumped.contains("a/signal@2.0.0"));
        assert!(!bumped.contains("1.0.0"));
        let removed = remove_line(&bumped, "dependencies", "Signal");
        assert!(!removed.contains("Signal ="));
    }
}
