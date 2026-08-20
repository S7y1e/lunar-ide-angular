#!/usr/bin/env bun
/**
 * Downloads the latest binaries for all external tools (luau-lsp, rojo, argon,
 * rokit, wally) for all supported Tauri target triples and places them in
 * src-tauri/binaries/.
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
  // Return null when the release has no build for that triple.
  assetName: (
    version: string,
    platform: string,
    arch: string
  ) => string | null;
  // For triples with no asset of their own, the triple to copy the binary from
  // — e.g. luau-lsp ships one universal macOS build that serves both arches.
  // Leave unset and a missing asset is simply skipped.
  reuseFrom?: (platform: string, arch: string) => string | null;
  // The binary filename inside the zip (without .exe — we add that for Windows).
  binaryName: string;
  // Pin to a specific tag instead of floating on "latest". Set this when a
  // newer release is confirmed to regress something we depend on — e.g.
  // luau-lsp 1.69.0 fails to parse resources/globalTypes.PluginSecurity.d.luau
  // ("Failed to read definitions file"), while 1.68.1 reads it cleanly.
  // Bump only after manually verifying the new version against that file.
  pinnedVersion?: string;
}

const TOOLS: Tool[] = [
  {
    name: "luau-lsp",
    repo: "JohnnyMorganz/luau-lsp",
    binaryName: "luau-lsp",
    pinnedVersion: "1.68.1",
    assetName: (_version, platform, arch) => {
      if (platform === "windows") return "luau-lsp-win64.zip";
      if (platform === "linux") return `luau-lsp-linux-${arch}.zip`;
      // macOS: single universal binary for both x86_64 and aarch64
      if (platform === "macos") {
        return arch === "aarch64" ? null : "luau-lsp-macos.zip";
      }
      return null;
    },
    reuseFrom: (platform, arch) =>
      platform === "macos" && arch === "aarch64" ? "x86_64-apple-darwin" : null,
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
  {
    // Bundled rather than left to the user's PATH: the IDE shells out to wally
    // for `wally install` (Packages panel, TestEZ setup), and a GUI app started
    // from a desktop launcher does not see ~/.rokit/bin or a login shell's PATH.
    name: "wally",
    repo: "UpliftGames/wally",
    binaryName: "wally",
    assetName: (version, platform, arch) => {
      // Wally keeps the "v" in its asset names and only publishes x86_64 builds.
      if (arch !== "x86_64") return null;
      if (platform === "windows") return `wally-v${version}-win64.zip`;
      return `wally-v${version}-${platform}.zip`;
    },
  },
];

async function getRelease(
  repo: string,
  pinnedVersion?: string
): Promise<{ version: string; assets: Record<string, string> }> {
  // Tag format isn't consistent across repos (luau-lsp tags "1.68.1", rojo/argon/rokit
  // tag "v1.2.3"), so pinnedVersion must be given as the exact tag string.
  const url = pinnedVersion
    ? `https://api.github.com/repos/${repo}/releases/tags/${pinnedVersion}`
    : `https://api.github.com/repos/${repo}/releases/latest`;
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
    const { version, assets } = await getRelease(tool.repo, tool.pinnedVersion);
    console.log(`  ${tool.pinnedVersion ? "Pinned" : "Latest"} version: ${version}`);

    // For luau-lsp macOS: download the universal zip once and use for both triples
    const macosCachedZip: Record<string, Uint8Array> = {};

    for (const target of TARGETS) {
      const { triple, platform, arch } = target;
      const isWindows = platform === "windows";

      const assetFilename = tool.assetName(version, platform, arch);

      // No asset for this triple: either copy from the triple the tool shares a
      // universal build with, or skip. Never guess a source — copying an x86_64
      // build to an aarch64 filename ships a binary that cannot run.
      if (assetFilename === null) {
        const srcTriple = tool.reuseFrom?.(platform, arch) ?? null;
        if (!srcTriple) {
          console.log(`  [${triple}] Skipping (no build published for this target)`);
          continue;
        }
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
