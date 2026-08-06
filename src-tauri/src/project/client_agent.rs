use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::State;

use super::ProjectStore;

const AGENT_FILE: &str = "__LunarClientAgent.client.luau";

// A LocalScript that runs INSIDE the play-test client (which the edit-context
// plugin can't observe) and streams the client's own output to the bridge.
const AGENT_SOURCE: &str = r#"--!strict
-- Injected by Lunar. Streams this play-test CLIENT's output to the IDE, since the
-- Studio plugin (server/edit context) can't see the client VM. Removed on Stop.
local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

if not RunService:IsClient() then
	return
end

local ENDPOINT = "http://127.0.0.1:34900"
local LEVEL = {
	[Enum.MessageType.MessageOutput] = "output",
	[Enum.MessageType.MessageInfo] = "info",
	[Enum.MessageType.MessageWarning] = "warning",
	[Enum.MessageType.MessageError] = "error",
}

local queue = {}
local ok, history = pcall(function()
	return LogService:GetLogHistory()
end)
if ok and type(history) == "table" then
	for _, e in history do
		table.insert(queue, { text = e.message, type = LEVEL[e.messageType] or "output", time = e.timestamp })
	end
end

LogService.MessageOut:Connect(function(text, mt)
	table.insert(queue, { text = text, type = LEVEL[mt] or "output", time = os.time() })
end)

while true do
	task.wait(0.2)
	if #queue > 0 then
		local batch = queue
		queue = {}
		pcall(function()
			HttpService:PostAsync(ENDPOINT, HttpService:JSONEncode({ messages = batch }), Enum.HttpContentType.ApplicationJson)
		end)
	end
end
"#;

// First existing directory reachable via a `$path` under the given subtree.
fn first_path_dir(root: &Path, node: &Value) -> Option<PathBuf> {
    if let Some(p) = node.get("$path").and_then(|v| v.as_str()) {
        let abs = root.join(p.replace('/', std::path::MAIN_SEPARATOR_STR));
        if abs.is_dir() {
            return Some(abs);
        }
    }
    if let Some(obj) = node.as_object() {
        for (key, val) in obj {
            if key.starts_with('$') {
                continue;
            }
            if let Some(dir) = first_path_dir(root, val) {
                return Some(dir);
            }
        }
    }
    None
}

// Depth-first search for a container named `name`, returning the first directory
// reachable under it.
fn find_named(root: &Path, node: &Value, name: &str) -> Option<PathBuf> {
    if let Some(obj) = node.as_object() {
        if let Some(child) = obj.get(name) {
            if let Some(dir) = first_path_dir(root, child) {
                return Some(dir);
            }
        }
        for (key, val) in obj {
            if key.starts_with('$') {
                continue;
            }
            if let Some(dir) = find_named(root, val, name) {
                return Some(dir);
            }
        }
    }
    None
}

const CLIENT_CONTAINERS: &[&str] =
    &["StarterPlayerScripts", "StarterGui", "StarterPack", "ReplicatedFirst"];

fn client_dir(root: &Path, project_file: &str) -> Option<PathBuf> {
    let text = std::fs::read_to_string(root.join(project_file)).ok()?;
    let json: Value = serde_json::from_str(&text).ok()?;
    let tree = json.get("tree")?;
    CLIENT_CONTAINERS
        .iter()
        .find_map(|name| find_named(root, tree, name))
}

fn project_root(store: &State<'_, ProjectStore>) -> Result<(PathBuf, String), String> {
    let guard = store.0.lock().unwrap();
    let m = guard.as_ref().ok_or("No project open")?;
    Ok((m.root.clone(), m.project_file.clone()))
}

#[tauri::command]
pub fn client_agent_install(store: State<'_, ProjectStore>) -> Result<(), String> {
    let (root, project_file) = project_root(&store)?;
    let dir = client_dir(&root, &project_file)
        .ok_or("No client container (StarterPlayerScripts) found in the project")?;
    std::fs::write(dir.join(AGENT_FILE), AGENT_SOURCE).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn client_agent_remove(store: State<'_, ProjectStore>) -> Result<(), String> {
    let (root, project_file) = project_root(&store)?;
    if let Some(dir) = client_dir(&root, &project_file) {
        let _ = std::fs::remove_file(dir.join(AGENT_FILE));
    }
    Ok(())
}
