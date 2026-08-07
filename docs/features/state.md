# State

The **State** tool streams live Lua tables from a running play-test into Lunar
as an expandable tree.

Nothing is watched automatically — you pick which tables to stream, start a
play-test, and their snapshots show up live as the game runs.

## Setup

Open the State window in Lunar, and you'll find a short walkthrough right there.

```lua
LunarInspect.watch(name, tableOrFn, opts?)
```

- **`name`** — the label shown as the tree root. Dotted paths like
  `PlayerManager.players` read nicely.
- **`tableOrFn`** — a table to snapshot, or a function that returns one (handy
  for locals you can't pass by reference up front).

Options:

| Option     | Default | Meaning                         |
|------------|---------|---------------------------------|
| `interval` | `0.5`   | Seconds between snapshots.      |
| `depth`    | `4`     | How deep to walk nested tables. |
| `maxKeys`  | `200`   | Max keys captured per table.    |

## Other functions

- `LunarInspect.unwatch(name)` — stops a watch and drops it from the panel.
- `LunarInspect.setSink(fn)` — swaps out the transport. It gets the JSON payload
  string, so you can route it through your Studio plugin when `HttpService`
  blocks `127.0.0.1`.