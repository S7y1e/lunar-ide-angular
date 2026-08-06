use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tiny_http::{Header, Response, Server};

const RUNTIME_PORT: u16 = 34900;

pub struct RuntimeBridge {
    running: Arc<Mutex<bool>>,
    queue: Arc<Mutex<VecDeque<String>>>,
}

impl Default for RuntimeBridge {
    fn default() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
            queue: Arc::new(Mutex::new(VecDeque::new())),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub running: bool,
    pub port: u16,
}

pub fn spawn(app: AppHandle, state: &RuntimeBridge) {
    if *state.running.lock().unwrap() {
        return;
    }
    let queue = Arc::clone(&state.queue);
    let running = Arc::clone(&state.running);

    std::thread::spawn(move || {
        // Retry the bind instead of giving up: on a quick app restart the previous
        // process may still hold the port (TIME_WAIT), which silently left the
        // bridge offline. Keep trying until the port frees up.
        let server = loop {
            match Server::http(("127.0.0.1", RUNTIME_PORT)) {
                Ok(s) => break s,
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(1000)),
            }
        };
        *running.lock().unwrap() = true;

        let json_ct = Header::from_bytes(b"Content-Type", b"application/json").unwrap();

        for mut request in server.incoming_requests() {
            // The Figma plugin pushes the selected frame here (no REST, no rate limit).
            if request.url().starts_with("/figma") {
                handle_figma(&app, request, &json_ct);
                continue;
            }
            if request.method() == &tiny_http::Method::Get {
                // Plugin polls GET /poll to drain pending IDE commands.
                let batch: Vec<String> = queue.lock().unwrap().drain(..).collect();
                let body = serde_json::to_string(&batch).unwrap_or_else(|_| "[]".into());
                let _ = request.respond(
                    Response::from_string(body).with_header(json_ct.clone()),
                );
            } else {
                // POST: Studio → IDE message stream. We answer with any pending
                // commands so the plugin never needs a separate poll request —
                // halving its HTTP traffic (Roblox throttles ~500 req/min).
                let mut body = String::new();
                let _ = request.as_reader().read_to_string(&mut body);
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
                    let _ = app.emit("runtime://message", value);
                }
                let batch: Vec<String> = queue.lock().unwrap().drain(..).collect();
                let resp = serde_json::to_string(&batch).unwrap_or_else(|_| "[]".into());
                let _ = request.respond(
                    Response::from_string(resp).with_header(json_ct.clone()),
                );
            }
        }
    });
}

// Ingest a frame from the Figma plugin and forward it to the UI as `figma://import`.
fn handle_figma(app: &AppHandle, mut request: tiny_http::Request, json_ct: &Header) {
    let cors = Header::from_bytes(b"Access-Control-Allow-Origin", b"*").unwrap();
    if request.method() == &tiny_http::Method::Options {
        let allow = Header::from_bytes(b"Access-Control-Allow-Headers", b"Content-Type").unwrap();
        let _ = request.respond(Response::empty(204).with_header(cors).with_header(allow));
        return;
    }
    let mut body = String::new();
    let _ = request.as_reader().read_to_string(&mut body);
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&body) {
        let _ = app.emit("figma://import", value);
    }
    let _ = request.respond(
        Response::from_string("{\"ok\":true}")
            .with_header(json_ct.clone())
            .with_header(cors),
    );
}

#[tauri::command]
pub fn runtime_bridge_status(state: State<'_, RuntimeBridge>) -> RuntimeStatus {
    RuntimeStatus {
        running: *state.running.lock().unwrap(),
        port: RUNTIME_PORT,
    }
}

#[tauri::command]
pub fn runtime_enqueue(state: State<'_, RuntimeBridge>, command: String) {
    state.queue.lock().unwrap().push_back(command);
}
