use std::collections::{HashMap, HashSet};

use super::dependencies::{resolve, script_file};
use super::luau_lex::{parse_chain, ChainArg, Tok};
use super::DataModelNode;

pub(super) struct Ctx {
    pub(super) root_name: String,
    pub(super) services: HashSet<String>,
    pub(super) by_chain: HashMap<Vec<String>, String>,
    pub(super) file_to_chain: HashMap<String, Vec<String>>,
    pub(super) class_by_chain: HashMap<Vec<String>, String>,
}

impl Ctx {
    pub(super) fn from_tree(tree: &DataModelNode) -> Self {
        let mut ctx = Ctx {
            root_name: tree.name.clone(),
            services: tree.children.iter().map(|c| c.name.clone()).collect(),
            by_chain: HashMap::new(),
            file_to_chain: HashMap::new(),
            class_by_chain: HashMap::new(),
        };
        ctx.walk(tree, &mut Vec::new());
        ctx
    }

    fn walk(&mut self, node: &DataModelNode, chain: &mut Vec<String>) {
        chain.push(node.name.clone());
        self.class_by_chain.insert(chain.clone(), node.class_name.clone());
        if let Some(file) = script_file(node) {
            self.by_chain.insert(chain.clone(), file.clone());
            self.file_to_chain.insert(file, chain.clone());
        }
        for child in &node.children {
            self.walk(child, chain);
        }
        chain.pop();
    }

    pub(super) fn resolve_instance(
        &self,
        segs: &[String],
        current: &Vec<String>,
        locals: &HashMap<String, Vec<String>>,
    ) -> Option<Vec<String>> {
        resolve(segs, Some(current), &self.root_name, &self.services, locals)
    }
}

pub(super) fn collect_bindings(
    ctx: &Ctx,
    tokens: &[Tok],
    current: &Vec<String>,
) -> (HashMap<String, Vec<String>>, HashMap<String, String>) {
    let mut inst: HashMap<String, Vec<String>> = HashMap::new();
    let mut modu: HashMap<String, String> = HashMap::new();

    for i in 0..tokens.len() {
        if tokens[i] != Tok::Local {
            continue;
        }
        let (Some(Tok::Ident(name)), Some(Tok::Equal)) =
            (tokens.get(i + 1), tokens.get(i + 2))
        else {
            continue;
        };

        if matches!(tokens.get(i + 3), Some(Tok::Ident(r)) if r == "require")
            && matches!(tokens.get(i + 4), Some(Tok::LParen))
        {
            if let Some(ChainArg::Path(segs)) = parse_chain(tokens, i + 5) {
                if let Some(chain) = ctx.resolve_instance(&segs, current, &inst) {
                    if let Some(file) = ctx.by_chain.get(&chain) {
                        modu.insert(name.clone(), file.clone());
                    }
                }
            }
            continue;
        }

        if let Some(ChainArg::Path(segs)) = parse_chain(tokens, i + 3) {
            if let Some(chain) = ctx.resolve_instance(&segs, current, &inst) {
                inst.insert(name.clone(), chain);
            }
        }
    }
    (inst, modu)
}

pub(super) fn receiver_before(tokens: &[Tok], before: usize) -> Option<(Vec<String>, usize)> {
    let mut segs = Vec::new();
    let mut j = before;
    let start;
    loop {
        let idx = j.checked_sub(1)?;
        match tokens.get(idx) {
            Some(Tok::Ident(name)) => {
                segs.push(name.clone());
                if j >= 2 && tokens.get(j - 2) == Some(&Tok::Dot) {
                    j -= 2;
                } else {
                    start = idx;
                    break;
                }
            }
            _ => return None,
        }
    }
    segs.reverse();
    Some((segs, start))
}

pub(super) fn base_module_name(file: &str) -> String {
    let name = file.rsplit('/').next().unwrap_or(file);
    name.trim_end_matches(".luau").trim_end_matches(".lua").to_string()
}

pub(super) fn instance_path(chain: &[String]) -> String {
    let mut out = vec!["game".to_string()];
    out.extend(chain.iter().skip(1).cloned());
    out.join(".")
}
