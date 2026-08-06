use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::State;

use crate::project::ProjectStore;

const LOG_FIELD: char = '\u{1f}';
const LOG_RECORD: char = '\u{1e}';

fn root(store: &State<'_, ProjectStore>) -> Result<PathBuf, String> {
    store.root().ok_or_else(|| "No project open".into())
}

fn git(root: &Path, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(root).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFile {
    pub path: String,
    pub index: String,  // staged status code (X)
    pub work: String,   // worktree status code (Y)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<GitFile>,
}

#[tauri::command]
pub fn git_is_repo(store: State<'_, ProjectStore>) -> bool {
    root(&store)
        .ok()
        .map(|r| git(&r, &["rev-parse", "--is-inside-work-tree"]).is_ok())
        .unwrap_or(false)
}

#[tauri::command]
pub fn git_status(store: State<'_, ProjectStore>) -> Result<GitStatus, String> {
    let root = root(&store)?;
    let out = git(&root, &["status", "--porcelain=v1", "--branch", "-uall"])?;
    let mut status = GitStatus {
        branch: "HEAD".into(),
        upstream: None,
        ahead: 0,
        behind: 0,
        files: vec![],
    };
    for line in out.lines() {
        if let Some(rest) = line.strip_prefix("## ") {
            parse_branch_line(rest, &mut status);
        } else if line.len() >= 3 {
            let (codes, path) = line.split_at(2);
            let chars: Vec<char> = codes.chars().collect();
            let mut path = path.trim_start().to_string();
            if let Some((_, to)) = path.split_once(" -> ") {
                path = to.to_string(); // rename: track the new name
            }
            status.files.push(GitFile {
                path,
                index: chars[0].to_string(),
                work: chars[1].to_string(),
            });
        }
    }
    Ok(status)
}

fn parse_branch_line(rest: &str, status: &mut GitStatus) {
    // "main...origin/main [ahead 1, behind 2]" or "main" or "No commits yet on main"
    let (head, track) = match rest.split_once(" [") {
        Some((h, t)) => (h, Some(t.trim_end_matches(']'))),
        None => (rest, None),
    };
    if let Some((local, up)) = head.split_once("...") {
        status.branch = local.to_string();
        status.upstream = Some(up.to_string());
    } else {
        status.branch = head.to_string();
    }
    if let Some(track) = track {
        for part in track.split(", ") {
            if let Some(n) = part.strip_prefix("ahead ") {
                status.ahead = n.parse().unwrap_or(0);
            } else if let Some(n) = part.strip_prefix("behind ") {
                status.behind = n.parse().unwrap_or(0);
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub short: String,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
    pub author: String,
    pub time: i64,
    pub subject: String,
}

#[tauri::command]
pub fn git_log(store: State<'_, ProjectStore>, limit: Option<u32>) -> Result<Vec<GitCommit>, String> {
    let root = root(&store)?;
    let fmt = format!(
        "--pretty=format:%H{f}%h{f}%P{f}%D{f}%an{f}%at{f}%s{r}",
        f = LOG_FIELD,
        r = LOG_RECORD
    );
    let limit = format!("-n{}", limit.unwrap_or(400));
    let out = git(&root, &["log", "--all", "--date-order", &limit, &fmt])?;
    let mut commits = vec![];
    for rec in out.split(LOG_RECORD) {
        let rec = rec.trim_start_matches('\n');
        if rec.is_empty() {
            continue;
        }
        let f: Vec<&str> = rec.split(LOG_FIELD).collect();
        if f.len() < 7 {
            continue;
        }
        let parents = f[2].split_whitespace().map(String::from).collect();
        let refs = f[3]
            .split(", ")
            .map(|r| r.trim().trim_start_matches("HEAD -> ").to_string())
            .filter(|r| !r.is_empty() && r != "HEAD")
            .collect();
        commits.push(GitCommit {
            hash: f[0].into(),
            short: f[1].into(),
            parents,
            refs,
            author: f[4].into(),
            time: f[5].parse().unwrap_or(0),
            subject: f[6].into(),
        });
    }
    Ok(commits)
}

#[tauri::command]
pub fn git_stage(store: State<'_, ProjectStore>, path: String) -> Result<(), String> {
    git(&root(&store)?, &["add", "--", &path]).map(|_| ())
}

#[tauri::command]
pub fn git_unstage(store: State<'_, ProjectStore>, path: String) -> Result<(), String> {
    git(&root(&store)?, &["reset", "-q", "HEAD", "--", &path]).map(|_| ())
}

#[tauri::command]
pub fn git_stage_all(store: State<'_, ProjectStore>) -> Result<(), String> {
    git(&root(&store)?, &["add", "-A"]).map(|_| ())
}

#[tauri::command]
pub fn git_discard(store: State<'_, ProjectStore>, path: String) -> Result<(), String> {
    git(&root(&store)?, &["checkout", "--", &path]).map(|_| ())
}

#[tauri::command]
pub fn git_commit(store: State<'_, ProjectStore>, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Empty commit message".into());
    }
    git(&root(&store)?, &["commit", "-m", &message])
}
