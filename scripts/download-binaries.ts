#!/usr/bin/env bun
/**
 * Downloads the latest binaries for all external tools (luau-lsp, rojo, argon, rokit)
 * for all supported Tauri target triples and places them in src-tauri/binaries/.
 *
 * Usage: bun run scripts/download-binaries.ts
 */

import { join } from "path";
import { mkdirSync, existsSync, writeFileSync, unlinkSync, chmodSync } from "fs";
import { unzipSync } from "fflate";

const BINARIES_DIR = join(import.meta.dir, "../src-tauri/binaries");

// Tauri target triple → { platform, arch } used in release asset names
const TARGETS: Array<{
  triple: string;
  platform: "windows" | "linux" | "macos";
  arch: "x86_64" | "aarch64";
}> = [
  { triple: "x86_64-pc-windows-msvc", platform: "windows", arch: "x86_64" },
  { triple: "x86_64-unknown-linux-gnu", platform: "linux", arch: "x86_64" },
  { triple: "aarch64-unknown-linux-gnu", platform: "linux", arch: "aarch64" },
  { triple: "x86_64-apple-darwin", platform: "macos", arch: "x86_64" },
  { triple: "aarch64-apple-darwin", platform: "macos", arch: "aarch64" },
];

interface Tool {
  name: string;
  repo: string;
  // Given platform+arch, return the asset filename in the GitHub release.
  // Return null to skip (e.g. luau-lsp has a single universal macos zip).
  assetName: (
    version: string,
    platform: string,
    arch: string
  ) => string | null;
  // The binary filename inside the zip (without .exe — we add that for Windows).
  binaryName: string;
}

const TOOLS: Tool[] = [
  {
    name: "luau-lsp",
    repo: "JohnnyMorganz/luau-lsp",
    binaryName: "luau-lsp",
    assetName: (_version, platform, arch) => {
      if (platform === "windows") return "luau-lsp-win64.zip";
      if (platform === "linux") return `luau-lsp-linux-${arch}.zip`;
      // macOS: single universal binary for both x86_64 and aarch64
      if (platform === "macos") {
        return arch === "aarch64" ? null : "luau-lsp-macos.zip";
      }
      return null;
    },
  },
  {
    name: "rojo",
    repo: "rojo-rbx/rojo",
    binaryName: "rojo",
    assetName: (version, platform, arch) =>
      `rojo-${version}-${platform}-${arch}.zip`,
  },
  {
    name: "argon",
    repo: "argon-rbx/argon",
    binaryName: "argon",
    assetName: (version, platform, arch) =>
      `argon-${version}-${platform}-${arch}.zip`,
  },
  {
    name: "rokit",
    repo: "rojo-rbx/rokit",
    binaryName: "rokit",
    assetName: (version, platform, arch) =>
      `rokit-${version}-${platform}-${arch}.zip`,
  },
];

async function getLatestRelease(
  repo: string
): Promise<{ version: string; assets: Record<string, string> }> {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch release for ${repo}: ${res.status}`);
  const data = await res.json();
  const version: string = (data.tag_name as string).replace(/^v/, "");
  const assets: Record<string, string> = {};
  for (const asset of data.assets as Array<{ name: string; browser_download_url: string }>) {
    assets[asset.name] = asset.browser_download_url;
  }
  return { version, assets };
}

async function downloadZip(url: string): Promise<Uint8Array> {
  console.log(`  Downloading ${url.split("/").pop()} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function extractBinaryFromZip(
  zipData: Uint8Array,
  binaryName: string,
  isWindows: boolean
): Uint8Array {
  const files = unzipSync(zipData);
  const target = isWindows ? `${binaryName}.exe` : binaryName;

  for (const [path, data] of Object.entries(files)) {
    const filename = path.split("/").pop()!;
    if (filename === target) return data;
  }

  // Fallback: any file matching the binary name (some zips have nested dirs)
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith(`/${target}`) || path === target) return data;
  }

  throw new Error(
    `Binary "${target}" not found in zip. Files: ${Object.keys(files).join(", ")}`
  );
}

async function main() {
  mkdirSync(BINARIES_DIR, { recursive: true });

  for (const tool of TOOLS) {
    console.log(`\n=== ${tool.name} (${tool.repo}) ===`);
    const { version, assets } = await getLatestRelease(tool.repo);
    console.log(`  Latest version: ${version}`);

    // For luau-lsp macOS: download the universal zip once and use for both triples
    const macosCachedZip: Record<string, Uint8Array> = {};

    for (const target of TARGETS) {
      const { triple, platform, arch } = target;
      const isWindows = platform === "windows";

      const assetFilename = tool.assetName(version, platform, arch);

      // null means "share with another triple" (e.g. luau-lsp aarch64-apple-darwin uses same zip as x86_64)
      if (assetFilename === null) {
        // For luau-lsp: copy from the x86_64 triple output
        const srcTriple = "x86_64-apple-darwin";
        const srcPath = join(BINARIES_DIR, `${tool.name}-${srcTriple}`);
        const destPath = join(BINARIES_DIR, `${tool.name}-${triple}`);
        if (existsSync(srcPath)) {
          console.log(`  [${triple}] Reusing universal macOS binary`);
          const data = await Bun.file(srcPath).arrayBuffer();
          // mode is only applied by writeFileSync when the file is newly created,
          // so an overwrite of a pre-existing (e.g. checked-in) file would silently
          // keep its old permissions — chmod explicitly to guarantee +x.
          writeFileSync(destPath, new Uint8Array(data), { mode: 0o755 });
          chmodSync(destPath, 0o755);
        } else {
          console.log(`  [${triple}] Skipping (universal binary not yet written)`);
        }
        continue;
      }

      const downloadUrl = assets[assetFilename];
      if (!downloadUrl) {
        console.warn(`  [${triple}] Asset "${assetFilename}" not found in release — skipping`);
        continue;
      }

      const destFilename = isWindows
        ? `${tool.name}-${triple}.exe`
        : `${tool.name}-${triple}`;
      const destPath = join(BINARIES_DIR, destFilename);

      try {
        let zipData = macosCachedZip[assetFilename];
        if (!zipData) {
          zipData = await downloadZip(downloadUrl);
          if (platform === "macos") macosCachedZip[assetFilename] = zipData;
        }

        const binary = extractBinaryFromZip(zipData, tool.binaryName, isWindows);
        // mode is only applied by writeFileSync when the file is newly created,
        // so an overwrite of a pre-existing (e.g. checked-in) file would silently
        // keep its old permissions — chmod explicitly to guarantee +x on Unix.
        writeFileSync(destPath, binary, { mode: isWindows ? 0o644 : 0o755 });
        if (!isWindows) chmodSync(destPath, 0o755);
        console.log(`  [${triple}] ✓ ${destFilename} (${(binary.length / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        console.error(`  [${triple}] ✗ ${(err as Error).message}`);
      }
    }
  }

  console.log("\nDone! All binaries written to src-tauri/binaries/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
