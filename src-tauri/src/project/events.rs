use serde::Serialize;
use tauri::State;

use super::event_scan::analyze;
use super::ProjectStore;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Signal {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub fired_by: Vec<String>,
    pub connected_by: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UnresolvedEvent {
    pub from: String,
    pub expr: String,
    pub action: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct EventGraph {
    pub signals: Vec<Signal>,
    pub unresolved: Vec<UnresolvedEvent>,
}

#[tauri::command]
pub fn project_events(store: State<'_, ProjectStore>) -> Option<EventGraph> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref()?;
        (m.root.clone(), m.project_file.clone())
    };
    let tree = super::sourcemap::generate(&root, &project_file)?;
    Some(analyze(&root, &tree))
}
