use std::fs;

use serde::Serialize;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Prop {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enum_name: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Class {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extends: Option<String>,
    pub props: Vec<Prop>,
    pub events: Vec<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApiModel {
    pub classes: Vec<Class>,
    pub enums: Vec<EnumDef>,
    pub creatable: Vec<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EnumDef {
    pub name: String,
    pub members: Vec<String>,
}

enum Ctx {
    None,
    Class(usize),
    Enum(usize),
}

// `EnumFont` -> `Font`; non-enum types -> None.
fn enum_base(ty: &str) -> Option<String> {
    let rest = ty.strip_prefix("Enum")?;
    if rest.is_empty() || !rest.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    Some(rest.to_string())
}

fn parse(src: &str) -> ApiModel {
    let mut model = ApiModel::default();
    let mut ctx = Ctx::None;

    for raw in src.lines() {
        if let Some(meta) = raw.strip_prefix("--#METADATA#") {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(meta) {
                if let Some(arr) = v.get("CREATABLE_INSTANCES").and_then(|x| x.as_array()) {
                    model.creatable =
                        arr.iter().filter_map(|s| s.as_str().map(String::from)).collect();
                }
            }
            continue;
        }

        let line = raw.trim_end();
        if let Some(decl) = line.trim_start().strip_prefix("declare class ") {
            ctx = Ctx::None;
            let closed = decl.ends_with(" end");
            let body = decl.strip_suffix(" end").unwrap_or(decl).trim();
            let (name, extends) = match body.split_once(" extends ") {
                Some((n, e)) => (n.trim(), Some(e.trim().to_string())),
                None => (body, None),
            };
            if name == "Enum" || name == "EnumItem" {
                continue;
            }
            if let Some(stripped) = name.strip_suffix("_INTERNAL") {
                // `EnumFont_INTERNAL extends Enum` — holds the member list.
                if let Some(base) = stripped.strip_prefix("Enum") {
                    model.enums.push(EnumDef { name: base.to_string(), ..Default::default() });
                    if !closed {
                        ctx = Ctx::Enum(model.enums.len() - 1);
                    }
                }
                continue;
            }
            if name.starts_with("Enum") {
                continue; // bare item type, e.g. `EnumFont extends EnumItem end`
            }
            model.classes.push(Class { name: name.to_string(), extends, ..Default::default() });
            if !closed {
                ctx = Ctx::Class(model.classes.len() - 1);
            }
            continue;
        }

        if line == "end" {
            ctx = Ctx::None;
            continue;
        }

        let member = line.trim_start();
        if member.starts_with("function ") {
            continue;
        }
        let Some((name, ty)) = member.split_once(": ") else { continue };
        let (name, ty) = (name.trim(), ty.trim());
        match ctx {
            Ctx::Class(i) => {
                let c = &mut model.classes[i];
                if ty.starts_with("RBXScriptSignal") {
                    c.events.push(name.to_string());
                } else {
                    c.props.push(Prop { name: name.to_string(), enum_name: enum_base(ty) });
                }
            }
            Ctx::Enum(i) => model.enums[i].members.push(name.to_string()),
            Ctx::None => {}
        }
    }

    model
}

#[tauri::command]
pub fn roblox_api(defs_path: String) -> Result<ApiModel, String> {
    let src = fs::read_to_string(&defs_path).map_err(|e| e.to_string())?;
    Ok(parse(&src))
}
