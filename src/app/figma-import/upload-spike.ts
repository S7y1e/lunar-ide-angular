// Phase 10.3 spike: prove AssetService:CreateAssetAsync works on the user's
// account/Studio (it's Beta + needs the AssetCreateUpdate capability). Runs over
// the eval bridge; results/errors print to the Lunar Runtime panel. Throwaway —
// once upload is wired, this goes away.

export const UPLOAD_SPIKE = `
local AssetService = game:GetService("AssetService")

local img
local ok1, err1 = pcall(function()
    img = AssetService:CreateEditableImage({ Size = Vector2.new(8, 8) })
end)
if not ok1 or not img then
    warn("[lunar] CreateEditableImage failed: " .. tostring(err1))
    return
end
print("[lunar] EditableImage created")

local buf = buffer.create(8 * 8 * 4)
for i = 0, 8 * 8 - 1 do
    buffer.writeu8(buf, i * 4, 255)
    buffer.writeu8(buf, i * 4 + 1, 0)
    buffer.writeu8(buf, i * 4 + 2, 0)
    buffer.writeu8(buf, i * 4 + 3, 255)
end
local ok2, err2 = pcall(function()
    img:WritePixelsBuffer(Vector2.zero, Vector2.new(8, 8), buf)
end)
if not ok2 then warn("[lunar] WritePixelsBuffer failed: " .. tostring(err2)) end

local ok3, res, assetId = pcall(function()
    return AssetService:CreateAssetAsync(img, Enum.AssetType.Image, {
        Name = "LunarUploadTest",
        Description = "Lunar IDE upload spike",
    })
end)
if not ok3 then
    warn("[lunar] CreateAssetAsync threw: " .. tostring(res))
    return
end
print("[lunar] CreateAssetAsync ->", tostring(res), tostring(assetId))
`;
