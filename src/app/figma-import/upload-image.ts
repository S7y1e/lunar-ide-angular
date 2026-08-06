// Image upload pipeline. The Figma plugin sends PNG bytes per image node; here we
// decode them to raw RGBA (in the webview's canvas) and emit a Luau script that
// rebuilds the pixels in Studio, uploads via CreateAssetAsync, and applies the
// resulting rbxassetid to every instance tagged with the matching LunarImage hash.
//
// Dedup: hash → rbxassetid is persisted in localStorage so we skip re-uploading
// the same image between "Send to Roblox" calls and across IDE sessions. Studio
// also keeps a _LunarAssetCache folder so dedup works within a Studio session even
// if the IDE cache is cold.

export interface FigmaImage {
    hash: string;
    png: string; // base64 PNG from the Figma plugin
}

// ── IDE-side asset cache (localStorage) ──────────────────────────────────────

const CACHE_KEY = "lunar-asset-cache";

function loadCache(): Record<string, string> {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}"); } catch { return {}; }
}

export function getCachedAsset(hash: string): string | null {
    return loadCache()[hash] ?? null;
}

export function setCachedAsset(hash: string, assetId: string): void {
    const c = loadCache();
    c[hash] = assetId;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
}

// Parse a "[lunar-asset] <hash> ok|reused <rbxassetid://…>" line from the runtime.
export function parseUploadResult(msg: string): { hash: string; assetId: string } | null {
    const m = msg.match(/\[lunar-asset\] (\S+) (?:ok|reused) (rbxassetid:\/\/\d+)/);
    if (!m) return null;
    return { hash: m[1], assetId: m[2] };
}

// Apply a known assetId to all matching instances — no upload needed.
export function buildApplyLuau(hash: string, assetId: string): string {
    return `do
\tfor _, d in ipairs(game:GetService("StarterGui"):GetDescendants()) do
\t\tif d:GetAttribute("LunarImage") == "${hash}" then
\t\t\td.Image = "${assetId}"
\t\t\td.BackgroundTransparency = 1
\t\tend
\tend
\tprint("[lunar-asset] ${hash} reused ${assetId}")
end`;
}

// Roblox's CreateEditableImage rejects sides >= 2048, so clamp under that here too.
const MAX_SIDE = 2000;

// PNG base64 -> raw RGBA base64 (+ dimensions), via an offscreen canvas. Oversized
// images are downscaled so they stay within the EditableImage limit.
export async function pngToRgba(pngBase64: string): Promise<{ rgba: string; w: number; h: number }> {
    const img = new Image();
    img.src = "data:image/png;base64," + pngBase64;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // base64 of the raw bytes, chunked so we don't blow the call stack on btoa.
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < data.length; i += CH) {
        bin += String.fromCharCode.apply(null, data.subarray(i, i + CH) as unknown as number[]);
    }
    return { rgba: btoa(bin), w, h };
}

// Luau: check Studio-side cache first; if hit, apply and skip upload. Otherwise
// decode RGBA → EditableImage → CreateAssetAsync → store in cache → apply.
export function buildUploadLuau(rgba: string, w: number, h: number, hash: string): string {
    return `do
\tlocal AssetService = game:GetService("AssetService")
\tlocal RS = game:GetService("ReplicatedStorage")
\tlocal SG = game:GetService("StarterGui")
\tlocal function applyId(assetId)
\t\tfor _, d in ipairs(SG:GetDescendants()) do
\t\t\tif d:GetAttribute("LunarImage") == "${hash}" then
\t\t\t\td.Image = assetId
\t\t\t\td.BackgroundTransparency = 1
\t\t\tend
\t\tend
\tend
\t-- Studio-session cache: _LunarAssetCache folder in ReplicatedStorage
\tlocal cache = RS:FindFirstChild("_LunarAssetCache") or (function()
\t\tlocal f = Instance.new("Folder"); f.Name = "_LunarAssetCache"; f.Parent = RS; return f
\tend)()
\tlocal cached = cache:FindFirstChild("${hash}")
\tif cached then
\t\tapplyId(cached.Value)
\t\tprint("[lunar-asset] ${hash} reused " .. cached.Value)
\t\treturn
\tend
\t-- Full upload
\tlocal CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
\tlocal map = {}
\tfor i = 1, #CH do map[string.byte(CH, i)] = i - 1 end
\tlocal data = "${rgba}"
\tlocal pad = 0
\tif string.sub(data, -2) == "==" then pad = 2 elseif string.sub(data, -1) == "=" then pad = 1 end
\tlocal outLen = (#data / 4) * 3 - pad
\tlocal buf = buffer.create(outLen)
\tlocal oi = 0
\tlocal i = 1
\twhile i <= #data do
\t\tlocal c1 = map[string.byte(data, i)] or 0
\t\tlocal c2 = map[string.byte(data, i + 1)] or 0
\t\tlocal c3 = map[string.byte(data, i + 2)] or 0
\t\tlocal c4 = map[string.byte(data, i + 3)] or 0
\t\tif oi < outLen then buffer.writeu8(buf, oi, c1 * 4 + math.floor(c2 / 16)); oi = oi + 1 end
\t\tif oi < outLen then buffer.writeu8(buf, oi, (c2 % 16) * 16 + math.floor(c3 / 4)); oi = oi + 1 end
\t\tif oi < outLen then buffer.writeu8(buf, oi, (c3 % 4) * 64 + c4); oi = oi + 1 end
\t\ti = i + 4
\tend
\tlocal img = AssetService:CreateEditableImage({ Size = Vector2.new(${w}, ${h}) })
\timg:WritePixelsBuffer(Vector2.zero, Vector2.new(${w}, ${h}), buf)
\tlocal ok, res, id = pcall(function()
\t\treturn AssetService:CreateAssetAsync(img, Enum.AssetType.Image, { Name = "Lunar", Description = "lunar" })
\tend)
\tif not ok or res ~= Enum.CreateAssetResult.Success then
\t\twarn("[lunar-asset] ${hash} fail " .. tostring(res))
\t\treturn
\tend
\tlocal assetId = "rbxassetid://" .. tostring(id)
\tlocal sv = Instance.new("StringValue"); sv.Name = "${hash}"; sv.Value = assetId; sv.Parent = cache
\tapplyId(assetId)
\tprint("[lunar-asset] ${hash} ok " .. assetId)
end`;
}
