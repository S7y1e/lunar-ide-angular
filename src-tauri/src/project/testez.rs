use std::path::Path;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use super::{run_shell, ProjectModel, ProjectStore, MANIFEST_FILE};

const TESTEZ_DEP: &str = "TestEZ = \"roblox/testez@0.4.1\"";
const DEFAULT_TESTEZ_PATH: &str = "game.ReplicatedStorage.Packages.TestEZ";
const DEFAULT_ROOT_PATH: &str = "game.ReplicatedStorage.Tests";

const EXAMPLE_SPEC: &str = "return function()\n\
\tdescribe(\"example suite\", function()\n\
\t\tit(\"adds numbers\", function()\n\
\t\t\texpect(1 + 1).to.equal(2)\n\
\t\tend)\n\
\n\
\t\tit(\"compares strings\", function()\n\
\t\t\texpect(\"lunar\").to.equal(\"lunar\")\n\
\t\tend)\n\
\tend)\n\
end\n";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestezSetup {
    pub log: String,
    pub spec_file: Option<String>,
}

// One-click onboarding: add the TestEZ wally dep + install, seed an example
// spec, and write [test] testez/roots into lunar.toml so the runner is ready.
#[tauri::command]
pub fn project_setup_testez(
    app: AppHandle,
    store: State<'_, ProjectStore>,
) -> Result<TestezSetup, String> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref().ok_or("No project open")?;
        (m.root.clone(), m.project_file.clone())
    };
    let mut log = String::new();

    let wally_path = root.join("wally.toml");
    let wally = std::fs::read_to_string(&wally_path)
        .map_err(|e| format!("wally.toml not found: {e}"))?;
    if !wally.to_lowercase().contains("testez") {
        std::fs::write(&wally_path, add_dependency(&wally)).map_err(|e| e.to_string())?;
        log.push_str("• Added TestEZ to wally.toml\n");
    } else {
        log.push_str("• wally.toml already lists TestEZ\n");
    }

    let install = run_shell(&root, "wally install")?;
    if install.code != 0 {
        return Err(format!(
            "wally install failed (exit {}):\n{}",
            install.code, install.output
        ));
    }
    log.push_str("• wally install OK\n");

    let manifest_path = root.join(MANIFEST_FILE);
    let manifest = std::fs::read_to_string(&manifest_path).unwrap_or_default();
    if !manifest.contains("testez") {
        std::fs::write(&manifest_path, add_test_config(&manifest)).map_err(|e| e.to_string())?;
        log.push_str("• Configured [test] testez + roots in lunar.toml\n");
    }

    let rs_dir = replicated_storage_dir(&root, &project_file)
        .unwrap_or_else(|| "src/ReplicatedStorage".to_string());
    let tests_dir = root.join(&rs_dir).join("Tests");
    let mut spec_file = None;
    if !has_spec(&tests_dir) {
        std::fs::create_dir_all(&tests_dir).map_err(|e| e.to_string())?;
        std::fs::write(tests_dir.join("example.spec.luau"), EXAMPLE_SPEC)
            .map_err(|e| e.to_string())?;
        spec_file = Some(format!("{}/Tests/example.spec.luau", rs_dir.replace('\\', "/")));
        log.push_str("• Created example.spec.luau\n");
    }

    log.push_str("\nNow sync to Studio and open it, then press ▶ Run.");

    // Refresh the store so the snapshot/run pick up the new [test] config.
    let model = ProjectModel::load(&root);
    let snapshot = model.snapshot();
    *store.0.lock().unwrap() = Some(model);
    let _ = app.emit("project://changed", ());
    let _ = app.emit("project://opened", snapshot);

    Ok(TestezSetup { log, spec_file })
}

fn add_dependency(content: &str) -> String {
    match content.find("[dependencies]") {
        Some(idx) => {
            let after = idx + "[dependencies]".len();
            let nl = content[after..]
                .find('\n')
                .map(|n| after + n + 1)
                .unwrap_or(content.len());
            format!("{}{}\n{}", &content[..nl], TESTEZ_DEP, &content[nl..])
        }
        None => format!("{}\n[dependencies]\n{}\n", content.trim_end(), TESTEZ_DEP),
    }
}

fn add_test_config(content: &str) -> String {
    let block = format!(
        "testez = \"{}\"\nroots = [\"{}\"]\n",
        DEFAULT_TESTEZ_PATH, DEFAULT_ROOT_PATH
    );
    match content.find("[test]") {
        Some(idx) => {
            let after = idx + "[test]".len();
            let nl = content[after..]
                .find('\n')
                .map(|n| after + n + 1)
                .unwrap_or(content.len());
            format!("{}{}{}", &content[..nl], block, &content[nl..])
        }
        None => format!("{}\n[test]\n{}", content.trim_end(), block),
    }
}

fn replicated_storage_dir(root: &Path, project_file: &str) -> Option<String> {
    let text = std::fs::read_to_string(root.join(project_file)).ok()?;
    let json: Value = serde_json::from_str(&text).ok()?;
    json.get("tree")?
        .get("ReplicatedStorage")?
        .get("$path")?
        .as_str()
        .map(String::from)
}

fn has_spec(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .any(|e| e.file_name().to_string_lossy().ends_with(".spec.luau"))
}
