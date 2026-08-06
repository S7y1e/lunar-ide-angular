use std::collections::HashMap;
use std::path::Path;

use super::dependencies::is_vendored;
use super::event_ctx::{
    base_module_name, collect_bindings, instance_path, receiver_before, Ctx,
};
use super::events::{EventGraph, Signal, UnresolvedEvent};
use super::luau_lex::{lex, Tok};
use super::DataModelNode;

const SIGNAL_CLASSES: [&str; 5] = [
    "RemoteEvent",
    "UnreliableRemoteEvent",
    "RemoteFunction",
    "BindableEvent",
    "BindableFunction",
];

const EVENT_PORTS: [&str; 4] = ["OnServerEvent", "OnClientEvent", "Event", "Changed"];

#[derive(Clone, Copy, PartialEq)]
enum Action {
    Fire,
    Connect,
}

fn classify(method: &str) -> Option<Action> {
    match method {
        "Connect" | "Once" | "ConnectParallel" => Some(Action::Connect),
        "Fire" | "FireServer" | "FireClient" | "FireAllClients" | "Invoke"
        | "InvokeServer" | "InvokeClient" => Some(Action::Fire),
        _ => None,
    }
}

#[derive(Default)]
struct Acc {
    signals: HashMap<String, Signal>,
    unresolved: Vec<UnresolvedEvent>,
}

impl Acc {
    fn record(&mut self, id: String, label: String, kind: String, action: Action, file: &str) {
        let sig = self.signals.entry(id.clone()).or_insert_with(|| Signal {
            id,
            label,
            kind,
            fired_by: Vec::new(),
            connected_by: Vec::new(),
        });
        let bucket = match action {
            Action::Fire => &mut sig.fired_by,
            Action::Connect => &mut sig.connected_by,
        };
        if !bucket.iter().any(|f| f == file) {
            bucket.push(file.to_string());
        }
    }
}

pub(super) fn analyze(root: &Path, tree: &DataModelNode) -> EventGraph {
    let ctx = Ctx::from_tree(tree);
    let mut acc = Acc::default();

    for (file, chain) in &ctx.file_to_chain {
        if is_vendored(file) {
            continue;
        }
        let content = match std::fs::read_to_string(root.join(file)) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let tokens = lex(&content);
        let (inst, modu) = collect_bindings(&ctx, &tokens, chain);
        scan_file(&ctx, &inst, &modu, chain, &tokens, file, &mut acc);
    }

    let mut signals: Vec<Signal> = acc.signals.into_values().collect();
    signals.sort_by(|a, b| a.label.cmp(&b.label));
    EventGraph {
        signals,
        unresolved: acc.unresolved,
    }
}

fn scan_file(
    ctx: &Ctx,
    inst: &HashMap<String, Vec<String>>,
    modu: &HashMap<String, String>,
    current: &Vec<String>,
    tokens: &[Tok],
    file: &str,
    acc: &mut Acc,
) {
    for i in 0..tokens.len() {
        if tokens[i] != Tok::Colon || !matches!(tokens.get(i + 2), Some(Tok::LParen)) {
            continue;
        }
        let Some(Tok::Ident(method)) = tokens.get(i + 1) else {
            continue;
        };
        let Some(action) = classify(method) else {
            continue;
        };
        let Some((mut recv, start)) = receiver_before(tokens, i) else {
            continue;
        };
        if start > 0
            && matches!(tokens.get(start - 1), Some(Tok::Ident(kw)) if kw == "function")
        {
            continue;
        }

        if action == Action::Connect {
            if let Some(last) = recv.last() {
                if EVENT_PORTS.contains(&last.as_str()) {
                    recv.pop();
                }
            }
        }
        if recv.is_empty() {
            continue;
        }

        resolve_signal(ctx, inst, modu, current, &recv, action, file, acc);
    }
}

#[allow(clippy::too_many_arguments)]
fn resolve_signal(
    ctx: &Ctx,
    inst: &HashMap<String, Vec<String>>,
    modu: &HashMap<String, String>,
    current: &Vec<String>,
    recv: &[String],
    action: Action,
    file: &str,
    acc: &mut Acc,
) {
    let head = &recv[0];

    if let Some(module_file) = modu.get(head) {
        let field = recv[1..].join(".");
        let label = if field.is_empty() {
            base_module_name(module_file)
        } else {
            format!("{}.{}", base_module_name(module_file), field)
        };
        acc.record(
            format!("m:{module_file}#{field}"),
            label,
            "module".to_string(),
            action,
            file,
        );
        return;
    }

    if let Some(chain) = ctx.resolve_instance(recv, current, inst) {
        if let Some(class) = ctx.class_by_chain.get(&chain) {
            if SIGNAL_CLASSES.contains(&class.as_str()) {
                acc.record(
                    format!("i:{}", chain.join("/")),
                    instance_path(&chain),
                    class.clone(),
                    action,
                    file,
                );
                return;
            }
        }
    }

    let head = recv[0].as_str();
    if head == "script"
        || head == "game"
        || ctx.services.contains(head)
        || inst.contains_key(head)
    {
        return;
    }

    acc.unresolved.push(UnresolvedEvent {
        from: file.to_string(),
        expr: recv.join("."),
        action: match action {
            Action::Fire => "fire".to_string(),
            Action::Connect => "connect".to_string(),
        },
    });
}
