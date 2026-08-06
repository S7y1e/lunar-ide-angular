--!strict
-- LunarInspect — stream live game state to the Lunar IDE "State" tool window.
-- Drop this ModuleScript into your game and require it from any server/client script:
--
--   local LunarInspect = require(path.to.LunarInspect)
--   LunarInspect.watch("PlayerManager.players", players)   -- a Lua table you own
--
-- It snapshots each watched table on an interval and POSTs it to the Lunar bridge
-- (http://127.0.0.1:34900). Enable Game Settings > Security > Allow HTTP Requests.

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

local ENDPOINT = "http://127.0.0.1:34900"

type Opts = { interval: number, depth: number, maxKeys: number }
type Entry = { source: any, opts: Opts, acc: number }

local LunarInspect = {}

local watches: { [string]: Entry } = {}
local started = false

local sink = function(payload: string)
	pcall(function()
		HttpService:PostAsync(ENDPOINT, payload, Enum.HttpContentType.ApplicationJson)
	end)
end

-- Bound a value into something JSON-encodable: limit depth & key count, break
-- cycles, and render Roblox datatypes as display strings.
local function snap(value: any, depth: number, maxKeys: number, seen: { [any]: boolean }): any
	local t = typeof(value)
	if t == "table" then
		if depth <= 0 then return "{…}" end
		if seen[value] then return "<cycle>" end
		seen[value] = true
		local out: { [string]: any } = {}
		local n = 0
		for k, v in pairs(value) do
			if n >= maxKeys then
				out["…"] = "(" .. tostring(n) .. "+ keys)"
				break
			end
			out[tostring(k)] = snap(v, depth - 1, maxKeys, seen)
			n += 1
		end
		seen[value] = nil
		return out
	elseif t == "Instance" then
		return value.ClassName .. " " .. value:GetFullName()
	elseif t == "string" or t == "number" or t == "boolean" or t == "nil" then
		return value
	else
		return tostring(value) -- Vector3, Enum, CFrame, function, etc.
	end
end

local function send(name: string, e: Entry)
	local source = typeof(e.source) == "function" and e.source() or e.source
	local body = HttpService:JSONEncode({
		state = {
			watches = {
				{
					name = name,
					snapshot = snap(source, e.opts.depth, e.opts.maxKeys, {}),
					t = os.clock(),
				},
			},
		},
	})
	sink(body)
end

local function ensureLoop()
	if started then return end
	started = true
	RunService.Heartbeat:Connect(function(dt)
		for name, e in pairs(watches) do
			e.acc += dt
			if e.acc >= e.opts.interval then
				e.acc = 0
				send(name, e)
			end
		end
	end)
end

-- tableOrFn: a table to snapshot, or a function returning one (for locals you
-- can't pass by reference up front).
function LunarInspect.watch(name: string, tableOrFn: any, opts: Opts?)
	local o = opts or {}
	watches[name] = {
		source = tableOrFn,
		opts = {
			interval = o.interval or 0.5,
			depth = o.depth or 4,
			maxKeys = o.maxKeys or 200,
		},
		acc = math.huge, -- send immediately on first heartbeat
	}
	ensureLoop()
end

function LunarInspect.unwatch(name: string)
	watches[name] = nil
	sink(HttpService:JSONEncode({ state = { watches = { { name = name, gone = true } } } }))
end

-- Replace the transport (e.g. forward through your Studio plugin instead of a
-- direct HTTP POST). Receives the already-JSON-encoded payload string.
function LunarInspect.setSink(fn: (string) -> ())
	sink = fn
end

return LunarInspect
