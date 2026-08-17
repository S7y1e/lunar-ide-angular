# Lunar IDE

My own IDE for Luau — built with Tauri, Angular, and Monaco Editor.

A personal project for an IDE that meets my needs for working with Roblox Studio.
It will always be free and source-available.

## Features

- **Luau editor** powered by Monaco, with [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp)
  for autocomplete, diagnostics, and hover info
- **UI-library autocomplete** for Fusion, vide, and React props and events
- **File explorer** with tabs, context menu, rename/create/delete
- **Command palette** and fuzzy file search
- **Integrated terminal** (xterm.js + native PTY)
- **Sync to Roblox Studio** via bundled [Rojo](https://github.com/rojo-rbx/rojo)
  or [Argon](https://github.com/argon-rbx/argon) servers
- **Toolchain manager** powered by [Rokit](https://github.com/rojo-rbx/rokit) —
  install tools like StyLua, Selene, Wally, Lune, and more
- **Themes** — Nord, Dracula, and Studio
- **Cross-platform** — Windows, macOS, and Linux

## Tech Stack

- **Frontend:** Angular 22 + TypeScript
- **Editor:** Monaco Editor
- **Backend:** Tauri 2 (Rust)
- **Language Server:** luau-lsp

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Bun](https://bun.sh/) — only for `download-binaries`
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri system dependencies — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

### Installation

```bash
# Install dependencies
npm ci

# Download bundled tool binaries (luau-lsp, rojo, argon, rokit)
npm run download-binaries
```

> `download-binaries` uses [Bun](https://bun.sh/) to fetch the releases for every
> supported platform into `src-tauri/binaries/`, and marks them executable. The
> copies committed to git are not executable, so this step is required before the
> app can spawn any of its sidecars.

### Development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Tests

```bash
npm test
```

## Acknowledgements

Lunar bundles and builds on top of these open source projects:

- [Tauri](https://github.com/tauri-apps/tauri) — MIT / Apache-2.0
- [Angular](https://github.com/angular/angular) — MIT
- [Monaco Editor](https://github.com/microsoft/monaco-editor) — MIT
- [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp) — MIT
- [Luau](https://github.com/luau-lang/luau) — MIT
- [Rojo](https://github.com/rojo-rbx/rojo) — MPL-2.0
- [Argon](https://github.com/argon-rbx/argon) — Apache-2.0
- [Rokit](https://github.com/rojo-rbx/rokit) — MPL-2.0
- [xterm.js](https://github.com/xtermjs/xterm.js) — MIT

### Icons & Fonts

- [charmed-icons](https://github.com/littensy/charmed-icons) by Littensy — MIT (file-tree icons)
- [Material Symbols](https://github.com/google/material-design-icons) — Apache-2.0
- [Inter](https://github.com/rsms/inter) — SIL Open Font License 1.1
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) — SIL Open Font License 1.1

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to use, modify, and share for any
**noncommercial** purpose. Selling Lunar, or any product built on it, is not permitted.
