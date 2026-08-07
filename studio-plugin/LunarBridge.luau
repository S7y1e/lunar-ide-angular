--!strict
-- Lunar Studio bridge — streams play-test output to the Lunar IDE and runs the
-- IDE's eval/watch commands. Talks to the local bridge at 127.0.0.1:34900.

local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local VERSION = "4.0.2" -- keep in sync with the Lunar IDE release

local RELAY_NAME = "_LunarLogRelay"

local ENDPOINT = "http://127.0.0.1:34900"

-- During a play-test the plugin loads into the play server + client DataModels
-- too, each with its own log and HttpService — behaviour below branches on this.
local context = if RunService:IsEdit()
	then "edit"
	elseif RunService:IsClient() then "client"
	else "server"

local LEVEL: { [Enum.MessageType]: string } = {
	[Enum.MessageType.MessageOutput] = "output",
	[Enum.MessageType.MessageInfo] = "info",
	[Enum.MessageType.MessageWarning] = "warning",
	[Enum.MessageType.MessageError] = "error",
}

local toolbar = plugin:CreateToolbar("Lunar")
toolbar:CreateButton("Bridge", "Stream play-test output to Lunar", "")

print(string.format("[Lunar] Bridge v%s loaded (%s)", VERSION, context))

-- Forward declared so post() can dispatch commands the IDE returns.
local handleCommand: (raw: string) -> ()

-- POST output to the IDE; the IDE replies with any queued commands (eval/watch),
-- so we never need a separate poll request.
local postOk = true
local function post(body: { [string]: any })
	local ok, response = pcall(function()
		return HttpService:PostAsync(
			ENDPOINT,
			HttpService:JSONEncode(body),
			Enum.HttpContentType.ApplicationJson
		)
	end)
	-- Surface transport failures in Studio's output, once per state change.
	if ok ~= postOk then
		postOk = ok
		if not ok then
			warn(`[Lunar] POST failed ({context}): {response}`)
		end
	end
	if ok and response and response ~= "[]" then
		local decoded, cmds = pcall(function()
			return HttpService:JSONDecode(response)
		end)
		if decoded and type(cmds) == "table" then
			for _, raw in cmds do
				pcall(handleCommand, raw)
			end
		end
	end
end

-- loadstring is unavailable in the plugin (edit) context but works in the play
-- runtime VM, so paths are resolved by hand here: a root (game/workspace/Enum/
-- plugin) followed by `.name`, `["name"]` or `[n]` accessors, optional `#` length
-- prefix. Calls and arithmetic only work via loadstring during a play-test.
local ROOTS: { [string]: any } = { game = game, workspace = workspace, Enum = Enum, plugin = plugin }

local function pathEval(code: string): (boolean, string)
	local expr = code:gsub("^%s+", ""):gsub("%s+$", "")
	local wantLen = false
	if expr:sub(1, 1) == "#" then
		wantLen = true
		expr = expr:sub(2):gsub("^%s+", "")
	end

	local root, rest = expr:match("^([%a_][%w_]*)(.*)$")
	if not root or ROOTS[root] == nil then
		return false, "Lunar eval: only property paths (e.g. workspace.Name); calls/math need a play-test"
	end
	local current: any = ROOTS[root]

	while rest ~= "" do
		local key, after = rest:match("^%.([%a_][%w_]*)(.*)$")
		if not key then
			local idx
			idx, after = rest:match("^%[\"([^\"]*)\"%](.*)$")
			if not idx then
				local num
				num, after = rest:match("^%[(%d+)%](.*)$")
				if num then
					idx = tonumber(num)
				end
			end
			if idx == nil then
				return false, "Lunar eval: only property paths; calls/math need a play-test"
			end
			key = idx
		end
		local ok, value = pcall(function()
			return (current :: any)[key]
		end)
		if not ok then
			return false, tostring(value)
		end
		current = value
		rest = after
	end

	if wantLen then
		local ok, len = pcall(function()
			return #current
		end)
		if not ok then
			return false, tostring(len)
		end
		return true, tostring(len)
	end
	return true, tostring(current)
end

-- Full eval via loadstring when usable (play runtime); falls back to pathEval in
-- the plugin/edit/server context. loadstring exists as a global even when
-- disabled and only throws when CALLED, so the call itself must be pcall'd.
local function evalExpr(code: string): (boolean, string)
	local compiled, fn = pcall(function()
		return loadstring("return " .. code) or loadstring(code)
	end)
	if not compiled or not fn then
		return pathEval(code)
	end
	local results = table.pack(pcall(fn))
	if not results[1] then
		return false, tostring(results[2])
	end
	local parts = {}
	for i = 2, results.n do
		table.insert(parts, tostring(results[i]))
	end
	return true, table.concat(parts, ", ")
end

-- Resolve a DataModel path ("game.ReplicatedStorage.Packages.TestEZ") to its
-- Instance, reusing pathEval's accessor grammar. Returns the instance or an error.
local function resolveInstance(path: string): (Instance?, string?)
	local rest = path:gsub("^%s+", ""):gsub("%s+$", "")
	local root, after = rest:match("^([%a_][%w_]*)(.*)$")
	if not root or ROOTS[root] == nil then
		return nil, `Lunar tests: unknown root in "{path}"`
	end
	local current: any = ROOTS[root]
	rest = after
	while rest ~= "" do
		local key
		key, after = rest:match("^%.([%a_][%w_]*)(.*)$")
		if not key then
			key, after = rest:match('^%["([^"]*)"%](.*)$')
		end
		if not key then
			return nil, `Lunar tests: bad segment in "{path}"`
		end
		local ok, value = pcall(function()
			return (current :: any)[key]
		end)
		if not ok or value == nil then
			return nil, `Lunar tests: "{path}" not found`
		end
		current = value
		rest = after
	end
	if typeof(current) ~= "Instance" then
		return nil, `Lunar tests: "{path}" is not an Instance`
	end
	return current, nil
end

-- Flatten TestEZ's result tree into JSON-friendly nodes (phrase + type + status +
-- error strings + children), so the IDE can render it without knowing TestEZ.
local function stringifyErrors(errors: any): { string }
	local out: { string } = {}
	if type(errors) == "table" then
		for _, e in errors do
			table.insert(out, tostring(e))
		end
	end
	return out
end

local function serializeResult(node: any): any
	local plan = node.planNode
	local children: { any } = {}
	for _, child in node.children do
		table.insert(children, serializeResult(child))
	end
	return {
		phrase = (plan and plan.phrase) or "",
		nodeType = (plan and tostring(plan.type)) or "",
		status = tostring(node.status),
		errors = stringifyErrors(node.errors),
		children = children,
	}
end

-- Run TestEZ in the edit VM (loadstring-free): require the module + roots by path,
-- run with a no-op reporter, and post the serialized result tree to the IDE.
local function runTests(cmd: any)
	if type(cmd.testez) ~= "string" then
		post({ testResults = { error = "No [test] testez path set in lunar.toml" } })
		return
	end
	local testez, err = resolveInstance(cmd.testez)
	if not testez then
		post({ testResults = { error = err } })
		return
	end
	local roots: { Instance } = {}
	if type(cmd.roots) == "table" then
		for _, p in cmd.roots do
			if type(p) == "string" then
				local inst, rerr = resolveInstance(p)
				if not inst then
					post({ testResults = { error = rerr } })
					return
				end
				table.insert(roots, inst)
			end
		end
	end
	if #roots == 0 then
		post({ testResults = { error = "No [test] roots set in lunar.toml" } })
		return
	end
	local reqOk, TestEZ = pcall(require, testez :: any)
	if not reqOk then
		post({ testResults = { error = `require(TestEZ) failed: {tostring(TestEZ)}` } })
		return
	end
	-- Roblox caches require() by ModuleScript instance, and editing .Source does
	-- not bust it — so in edit mode a re-run would execute the previously-cached
	-- spec code. Clone the roots so each run requires fresh instances. (Modules
	-- required from OUTSIDE the roots still come from Studio's cache; for those a
	-- play-test is the only fully-fresh option.)
	local clones: { Instance } = {}
	for _, r in roots do
		local c = r:Clone()
		c.Parent = r.Parent
		table.insert(clones, c)
	end
	local runOk, results = pcall(function()
		return (TestEZ :: any).TestBootstrap:run(clones, { report = function() end })
	end)
	for _, c in clones do
		c:Destroy()
	end
	if not runOk then
		post({ testResults = { error = `TestEZ run failed: {tostring(results)}` } })
		return
	end
	local children: { any } = {}
	for _, n in results.children do
		table.insert(children, serializeResult(n))
	end
	post({
		testResults = {
			successCount = results.successCount,
			failureCount = results.failureCount,
			skippedCount = results.skippedCount,
			errors = stringifyErrors(results.errors),
			children = children,
		},
	})
end

local watches: { [string]: string } = {}

function handleCommand(raw: string)
	local ok, cmd = pcall(function()
		return HttpService:JSONDecode(raw)
	end)
	if not ok or type(cmd) ~= "table" then
		return
	end
	if cmd.type == "eval" and type(cmd.code) == "string" then
		local success, display = evalExpr(cmd.code)
		if not success then
			warn(`[Lunar] {display}`)
		elseif display ~= "" then
			print(`[Lunar] {display}`)
		end
	elseif cmd.type == "setWatches" and type(cmd.watches) == "table" then
		table.clear(watches)
		for _, w in cmd.watches do
			if type(w) == "table" and type(w.id) == "string" and type(w.expr) == "string" then
				watches[w.id] = w.expr
			end
		end
	elseif cmd.type == "runTests" then
		runTests(cmd)
	end
end

-- The client DataModel can't use HttpService ("Http requests can only be executed
-- by game server"), so the client relays its output to the server over a
-- RemoteEvent and the server posts it.
local relay: RemoteEvent? = nil
if context == "server" then
	relay = Instance.new("RemoteEvent")
	relay.Name = RELAY_NAME
	relay.Parent = ReplicatedStorage
	relay.OnServerEvent:Connect(function(_player, batch)
		if type(batch) == "table" then
			post({ messages = batch })
		end
	end)
elseif context == "client" then
	relay = ReplicatedStorage:FindFirstChild(RELAY_NAME) :: RemoteEvent?
		or ReplicatedStorage:WaitForChild(RELAY_NAME, 5) :: RemoteEvent?
end

-- Server/edit post directly; the client hands off to the server relay.
local function ship(batch: { any })
	if context == "client" then
		if relay then
			relay:FireServer(batch)
		end
	else
		post({ messages = batch })
	end
end

-- Output capture via GetLogHistory polling. MessageOut is bound to the edit
-- DataModel and never fires for play-test output, but GetLogHistory returns each
-- DataModel's own Output buffer, so we poll and forward newly appended lines.
local queue: { { text: string, type: string, time: number } } = {}

-- A play DataModel starts fresh, so all its history is real play output (backfill
-- from 0). The edit session has stale history (asset spam, old prints) we skip.
local sent = 0
if RunService:IsEdit() then
	local ok, history = pcall(function()
		return LogService:GetLogHistory()
	end)
	if ok and type(history) == "table" then
		sent = #history
	end
end

local function drainLog()
	local ok, history = pcall(function()
		return LogService:GetLogHistory()
	end)
	if not ok or type(history) ~= "table" then
		return
	end
	if #history < sent then
		sent = 0 -- buffer was cleared/rotated past our cursor: resync
	end
	for i = sent + 1, #history do
		local entry = history[i]
		table.insert(queue, {
			text = entry.message,
			type = LEVEL[entry.messageType] or "output",
			time = entry.timestamp,
		})
	end
	sent = #history
end

-- Poll + flush output every 200 ms.
task.spawn(function()
	while true do
		task.wait(0.2)
		drainLog()
		if #queue > 0 then
			local batch = queue
			queue = {}
			ship(batch)
		end
	end
end)

-- Heartbeat + watches need HTTP, so they only run on server/edit; the client
-- only relays output.
if context ~= "client" then
	-- Heartbeat (also pulls commands back even when there's no output).
	task.spawn(function()
		while true do
			post({ running = not RunService:IsEdit() })
			task.wait(0.5)
		end
	end)

	-- Watch expressions: re-evaluate each every 500 ms and post the values back.
	task.spawn(function()
		while true do
			task.wait(0.5)
			local results: { { id: string, value: string, ok: boolean } } = {}
			for id, expr in watches do
				local ok, display = evalExpr(expr)
				table.insert(results, { id = id, value = display, ok = ok })
			end
			if #results > 0 then
				post({ evalWatches = results })
			end
		end
	end)
end

-- Only edit announces itself, so the panel isn't spammed with three load lines.
if context == "edit" then
	print("[Lunar] bridge loaded")
end
