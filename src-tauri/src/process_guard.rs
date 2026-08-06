//! Ties spawned sidecars (Argon/Rojo) to the app's lifetime.
//!
//! Sidecars are spawned from the webview via the shell plugin, so an abrupt
//! exit of the app (Ctrl+C during `tauri dev`, a crash, Task Manager) never
//! runs the JS/Rust cleanup that would stop them — they get orphaned and keep
//! holding their port (and lock the build dir).
//!
//! On Windows we create a Job Object with KILL_ON_JOB_CLOSE at startup and
//! assign every sidecar to it. The job's only handle is owned by this process,
//! so the moment the process dies — for any reason — the OS closes that handle
//! and terminates everything in the job. No cleanup code has to run.

use std::sync::Mutex;
use tauri::State;

/// Holds the job handle (as an isize so the state is Send + Sync). 0 means "no
/// job" (creation failed or non-Windows), in which case assignment is a no-op.
pub struct JobGuard(Mutex<isize>);

impl JobGuard {
    pub fn new() -> Self {
        JobGuard(Mutex::new(create_job()))
    }
}

#[cfg(windows)]
fn create_job() -> isize {
    use std::mem::{size_of, zeroed};
    use windows_sys::Win32::System::JobObjects::{
        CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return 0;
        }

        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const core::ffi::c_void,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );

        // Intentionally never closed: the handle lives for the whole process so
        // KILL_ON_JOB_CLOSE fires exactly when the process goes away.
        job as isize
    }
}

#[cfg(not(windows))]
fn create_job() -> isize {
    0
}

/// Assign a spawned sidecar (by PID) to the kill-on-close job so it can't
/// outlive the app. No-op when there's no job (non-Windows or creation failed).
#[tauri::command]
pub fn assign_to_job(state: State<'_, JobGuard>, pid: u32) -> Result<(), String> {
    let job = *state.0.lock().unwrap();
    if job == 0 {
        return Ok(());
    }

    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
        use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE,
        };

        unsafe {
            let proc = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
            if proc.is_null() {
                return Err(format!("OpenProcess failed for pid {pid}"));
            }
            let ok = AssignProcessToJobObject(job as HANDLE, proc);
            CloseHandle(proc);
            if ok == 0 {
                return Err(format!("AssignProcessToJobObject failed for pid {pid}"));
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = pid;
    }

    Ok(())
}
