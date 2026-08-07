# Runtime

The **Runtime** panel at the bottom shows all `print()` and `warn()` output from your game while it's running in Studio. You can filter by text and toggle noise filtering to hide repetitive messages.

From the Runtime panel you can also **Play** and **Pause** your game directly from Lunar without switching to Studio.

## Watches

While a play-test is running, open the **Watches** sub-panel and type any Lua expression (e.g. `game.Players.LocalPlayer.Name`). Lunar evaluates it live through the Studio bridge and shows the result in real time, updating as the game runs.

## Logpoints

Right-click any expression in the editor and select **Add Logpoint**. When you hit Play, Lunar injects a `print()` at that line automatically — no need to edit your code. Logpoints are cleaned up when you stop the session.

You can also toggle **stack** on each logpoint to include a full `debug.traceback()` with every log entry.
