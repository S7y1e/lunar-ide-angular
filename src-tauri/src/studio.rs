// "Play / Stop in Studio" from the IDE: focus the Roblox Studio window and send
// F5 (play) or Shift+F5 (stop) to drive a play-test, then hand focus back to
// Lunar so the user keeps watching the State/Runtime panels.
//
// There is no Roblox API to start/stop a play-test, so this simulates the
// keypress. Windows-only; an error elsewhere.

#[cfg(windows)]
#[tauri::command]
pub fn studio_play(app: tauri::AppHandle, stop: bool) -> Result<(), String> {
    use std::time::Duration;
    use tauri::Manager;

    let hwnd = find_studio().ok_or_else(|| "Roblox Studio window not found".to_string())?;
    // HWND isn't Send; carry it across the thread boundary as an integer.
    let raw = hwnd as isize;

    std::thread::spawn(move || {
        use windows_sys::Win32::UI::WindowsAndMessaging::SetForegroundWindow;
        unsafe { SetForegroundWindow(raw as _) };
        std::thread::sleep(Duration::from_millis(150));
        send_playtest_key(stop);
        std::thread::sleep(Duration::from_millis(200));
        // Bring Lunar back to the front; the play-test keeps running unfocused.
        if let Some(win) = app.webview_windows().values().next() {
            let _ = win.set_focus();
        }
    });
    Ok(())
}

#[cfg(windows)]
fn find_studio() -> Option<*mut core::ffi::c_void> {
    use windows_sys::Win32::Foundation::{HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, IsWindowVisible,
    };

    unsafe extern "system" fn cb(hwnd: HWND, lparam: LPARAM) -> i32 {
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len > 0 {
            let title = String::from_utf16_lossy(&buf[..len as usize]);
            if title.contains("Roblox Studio") {
                *(lparam as *mut HWND) = hwnd;
                return 0; // stop enumerating
            }
        }
        1
    }

    let mut found: HWND = core::ptr::null_mut();
    unsafe { EnumWindows(Some(cb), &mut found as *mut HWND as LPARAM) };
    if found.is_null() {
        None
    } else {
        Some(found)
    }
}

// F5 starts a play-test; Shift+F5 stops it.
#[cfg(windows)]
fn send_playtest_key(stop: bool) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_F5, VK_SHIFT,
    };

    let key = |vk, flags| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    let mut inputs: Vec<INPUT> = Vec::new();
    if stop {
        inputs.push(key(VK_SHIFT, 0));
    }
    inputs.push(key(VK_F5, 0));
    inputs.push(key(VK_F5, KEYEVENTF_KEYUP));
    if stop {
        inputs.push(key(VK_SHIFT, KEYEVENTF_KEYUP));
    }
    unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_mut_ptr(),
            core::mem::size_of::<INPUT>() as i32,
        )
    };
}

#[cfg(not(windows))]
#[tauri::command]
pub fn studio_play(_app: tauri::AppHandle, _stop: bool) -> Result<(), String> {
    Err("Play from the IDE is only available on Windows".into())
}
