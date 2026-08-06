use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

pub mod callgraph;
pub mod client_agent;
pub mod dependencies;
pub mod events;
pub mod index;
pub mod insights;
pub mod logpoints;
pub mod packages;
pub mod refactor;
pub mod search;
pub mod sourcemap;
pub mod testez;
pub mod todos;
mod event_ctx;
mod event_scan;
mod lex_util;
mod luau_lex;

const DEFAULT_PROJECT_FILE: &str = "default.project.json";
const SOURCEMAP_FILE: &str = "sourcemap.json";
const MANIFEST_FILE: &str = "lunar.toml";

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Manifest {
    #[serde(default)]
    pub sync: SyncManifest,
    #[serde(default)]
    pub sourcemap: SourcemapManifest,
    #[serde(default)]
    pub test: TestManifest,
    #[serde(default)]
    pub build: BuildManifest,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct TestManifest {
    pub command: Option<String>,
    // TestEZ runner (over the Studio bridge): DataModel path to the TestEZ module
    // and the roots to run, e.g. testez = "game.ReplicatedStorage.Packages.TestEZ".
    pub testez: Option<String>,
    #[serde(default)]
    pub roots: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct BuildManifest {
    pub output: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SyncManifest {
    pub backend: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SourcemapManifest {
    pub project: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RojoProjectFile {
    name: String,
}

#[derive(Debug, Clone)]
pub struct ProjectModel {
    root: PathBuf,
    name: String,
    project_file: String,
    manifest: Manifest,
}

impl ProjectModel {
    fn load(root: &Path) -> Self {
        let manifest = std::fs::read_to_string(root.join(MANIFEST_FILE))
            .ok()
            .and_then(|text| toml::from_str::<Manifest>(&text).ok())
            .unwrap_or_default();

        let project_file = manifest
            .sourcemap
            .project
            .clone()
            .unwrap_or_else(|| DEFAULT_PROJECT_FILE.to_string());

        let name = std::fs::read_to_string(root.join(&project_file))
            .ok()
            .and_then(|text| serde_json::from_str::<RojoProjectFile>(&text).ok())
            .map(|project| project.name)
            .unwrap_or_else(|| folder_name(root));

        ProjectModel {
            root: root.to_path_buf(),
            name,
            project_file,
            manifest,
        }
    }

    fn snapshot(&self) -> ProjectSnapshot {
        ProjectSnapshot {
            root: self.root.to_string_lossy().into_owned(),
            name: self.name.clone(),
            project_file: self.project_file.clone(),
            sync_backend: self.sync_backend(),
            test_command: self.manifest.test.command.clone(),
            test_ez: self.manifest.test.testez.clone(),
            test_roots: self.manifest.test.roots.clone(),
            build_output: self.manifest.build.output.clone(),
        }
    }

    fn sync_backend(&self) -> Option<String> {
        self.manifest.sync.backend.clone().or_else(|| {
            self.root
                .join("argon.toml")
                .exists()
                .then(|| "argon".to_string())
        })
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub root: String,
    pub name: String,
    pub project_file: String,
    pub sync_backend: Option<String>,
    pub test_command: Option<String>,
    pub test_ez: Option<String>,
    pub test_roots: Vec<String>,
    pub build_output: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataModelNode {
    pub name: String,
    pub class_name: String,
    #[serde(default)]
    pub file_paths: Vec<String>,
    #[serde(default)]
    pub children: Vec<DataModelNode>,
}

#[derive(Default)]
pub struct ProjectStore(Mutex<Option<ProjectModel>>);

impl ProjectStore {
    pub fn root(&self) -> Option<PathBuf> {
        self.0.lock().unwrap().as_ref().map(|m| m.root.clone())
    }
}

#[tauri::command]
pub fn project_open(
    app: AppHandle,
    store: State<'_, ProjectStore>,
    root: String,
) -> ProjectSnapshot {
    let model = ProjectModel::load(Path::new(&root));
    let snapshot = model.snapshot();
    *store.0.lock().unwrap() = Some(model);
    let _ = app.emit("project://opened", snapshot.clone());
    snapshot
}

#[tauri::command]
pub fn project_close(app: AppHandle, store: State<'_, ProjectStore>) {
    *store.0.lock().unwrap() = None;
    let _ = app.emit("project://closed", ());
}

#[tauri::command]
pub fn project_snapshot(store: State<'_, ProjectStore>) -> Option<ProjectSnapshot> {
    store.0.lock().unwrap().as_ref().map(ProjectModel::snapshot)
}

#[tauri::command]
pub fn project_data_model(store: State<'_, ProjectStore>) -> Option<DataModelNode> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref()?;
        (m.root.clone(), m.project_file.clone())
    };
    sourcemap::generate(&root, &project_file)
}

#[tauri::command]
pub fn project_write_sourcemap(store: State<'_, ProjectStore>) -> Result<(), String> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref().ok_or("No project open")?;
        (m.root.clone(), m.project_file.clone())
    };
    let node = sourcemap::generate(&root, &project_file)
        .ok_or("Failed to generate sourcemap")?;
    let json = serde_json::to_string_pretty(&node).map_err(|e| e.to_string())?;
    std::fs::write(root.join(SOURCEMAP_FILE), json).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestRun {
    pub code: i32,
    pub output: String,
}

#[tauri::command]
pub fn project_run_test(store: State<'_, ProjectStore>) -> Result<TestRun, String> {
    let root = {
        let guard = store.0.lock().unwrap();
        guard.as_ref().ok_or("No project open")?.root.clone()
    };
    // Re-read the manifest from disk so editing lunar.toml's [test] command takes
    // effect immediately, without having to reopen the project.
    let manifest = std::fs::read_to_string(root.join(MANIFEST_FILE))
        .ok()
        .and_then(|text| toml::from_str::<Manifest>(&text).ok())
        .unwrap_or_default();
    let command = manifest
        .test
        .command
        .ok_or("No [test] command configured in lunar.toml")?;
    run_shell(&root, &command)
}

// Runs the manifest's declared test command through the platform shell so the
// user can write a normal command line (args, pipes) in lunar.toml.
fn run_shell(root: &Path, command: &str) -> Result<TestRun, String> {
    use std::process::Command as Proc;

    #[cfg(windows)]
    let output = {
        use std::os::windows::process::CommandExt;
        Proc::new("cmd")
            .args(["/C", command])
            .current_dir(root)
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .output()
    };
    #[cfg(not(windows))]
    let output = Proc::new("sh")
        .args(["-c", command])
        .current_dir(root)
        .output();

    let output = output.map_err(|e| e.to_string())?;
    let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.is_empty() {
        if !text.is_empty() {
            text.push('\n');
        }
        text.push_str(&stderr);
    }
    Ok(TestRun {
        code: output.status.code().unwrap_or(-1),
        output: text,
    })
}

fn folder_name(root: &Path) -> String {
    root.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project".to_string())
}
