use std::path::Path;
use serde_json::Value;
use super::DataModelNode;

fn class_for_filename(name: &str) -> &'static str {
    if name.ends_with(".server.luau") || name.ends_with(".server.lua") {
        "Script"
    } else if name.ends_with(".client.luau") || name.ends_with(".client.lua") {
        "LocalScript"
    } else {
        "ModuleScript"
    }
}

fn strip_luau_ext(name: &str) -> String {
    for ext in [".server.luau", ".client.luau", ".luau", ".server.lua", ".client.lua", ".lua"] {
        if let Some(s) = name.strip_suffix(ext) {
            return s.to_string();
        }
    }
    name.to_string()
}

fn is_script(name: &str) -> bool {
    name.ends_with(".luau") || name.ends_with(".lua")
}

const INIT_NAMES: &[&str] = &[
    "init.server.luau", "init.client.luau", "init.luau",
    "init.server.lua",  "init.client.lua",  "init.lua",
];

fn expand_dir(path: &Path, instance_name: &str) -> DataModelNode {
    // A directory carrying its own default.project.json is a nested project
    // (e.g. every Wally package: `{ tree: { $path: "lib" } }`). Honor it so the
    // package collapses to the ModuleScript the link file requires, instead of a
    // raw Folder. Without this, `_Index[...]["red"]` resolves to a Folder and the
    // require fails.
    let project = path.join("default.project.json");
    if project.exists() {
        if let Some(tree) = std::fs::read_to_string(&project)
            .ok()
            .and_then(|t| serde_json::from_str::<Value>(&t).ok())
            .and_then(|j| j.get("tree").cloned())
        {
            return walk_tree(path, instance_name, &tree);
        }
    }

    let mut file_paths: Vec<String> = vec![];
    let mut class_name = "Folder".to_string();
    let mut children: Vec<DataModelNode> = vec![];

    for init in INIT_NAMES {
        let p = path.join(init);
        if p.exists() {
            class_name = class_for_filename(init).to_string();
            file_paths.push(p.to_string_lossy().into_owned());
            break;
        }
    }

    let mut entries: Vec<_> = std::fs::read_dir(path)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let child_path = entry.path();
        let os_name = entry.file_name();
        let child_name = os_name.to_string_lossy();

        if INIT_NAMES.contains(&child_name.as_ref()) {
            continue;
        }

        if child_path.is_dir() {
            children.push(expand_dir(&child_path, &child_name));
        } else if child_path.is_file() && is_script(&child_name) {
            let node_name = strip_luau_ext(&child_name);
            children.push(DataModelNode {
                name: node_name,
                class_name: class_for_filename(&child_name).to_string(),
                file_paths: vec![child_path.to_string_lossy().into_owned()],
                children: vec![],
            });
        }
    }

    DataModelNode { name: instance_name.to_string(), class_name, file_paths, children }
}

fn expand_path(root: &Path, rel: &str, instance_name: &str) -> DataModelNode {
    let abs = root.join(rel);
    if abs.is_file() {
        let file_name = abs.file_name().unwrap_or_default().to_string_lossy().into_owned();
        return DataModelNode {
            name: instance_name.to_string(),
            class_name: class_for_filename(&file_name).to_string(),
            file_paths: vec![abs.to_string_lossy().into_owned()],
            children: vec![],
        };
    }
    if abs.is_dir() {
        return expand_dir(&abs, instance_name);
    }
    // Path doesn't exist yet (e.g. Packages before wally install) — empty folder.
    DataModelNode {
        name: instance_name.to_string(),
        class_name: "Folder".to_string(),
        file_paths: vec![],
        children: vec![],
    }
}

fn walk_tree(root: &Path, name: &str, node: &Value) -> DataModelNode {
    if let Some(rel) = node.get("$path").and_then(|v| v.as_str()) {
        let mut base = expand_path(root, rel, name);
        // Overlay explicit JSON children on top of the filesystem expansion.
        if let Some(obj) = node.as_object() {
            for (key, val) in obj {
                if key.starts_with('$') { continue; }
                base.children.retain(|c| c.name != *key);
                base.children.push(walk_tree(root, key, val));
            }
        }
        return base;
    }

    let class_name = node.get("$className")
        .and_then(|v| v.as_str())
        .unwrap_or("Folder")
        .to_string();

    let mut children = vec![];
    if let Some(obj) = node.as_object() {
        for (key, val) in obj {
            if key.starts_with('$') { continue; }
            children.push(walk_tree(root, key, val));
        }
    }

    DataModelNode { name: name.to_string(), class_name, file_paths: vec![], children }
}

// The whole app (dependency/event/usage resolution, the DataModel tree, the
// runtime stack remap) keys instances by source path relative to the project
// root with forward slashes. The filesystem walk above produces absolute paths,
// so rewrite them to that canonical form before handing the tree out.
fn relativize(node: &mut DataModelNode, root: &Path) {
    for p in node.file_paths.iter_mut() {
        *p = Path::new(p.as_str())
            .strip_prefix(root)
            .map(|r| r.to_path_buf())
            .unwrap_or_else(|_| Path::new(p.as_str()).to_path_buf())
            .to_string_lossy()
            .replace('\\', "/");
    }
    for child in &mut node.children {
        relativize(child, root);
    }
}

pub fn generate(root: &Path, project_file: &str) -> Option<DataModelNode> {
    let text = std::fs::read_to_string(root.join(project_file)).ok()?;
    let json: Value = serde_json::from_str(&text).ok()?;

    let name = json.get("name").and_then(|v| v.as_str()).unwrap_or("Game").to_string();
    let tree = json.get("tree")?;

    let class_name = tree.get("$className")
        .and_then(|v| v.as_str())
        .unwrap_or("DataModel")
        .to_string();

    let mut children = vec![];
    if let Some(obj) = tree.as_object() {
        for (key, val) in obj {
            if key.starts_with('$') { continue; }
            children.push(walk_tree(root, key, val));
        }
    }

    let mut node = DataModelNode { name, class_name, file_paths: vec![], children };
    relativize(&mut node, root);
    Some(node)
}
