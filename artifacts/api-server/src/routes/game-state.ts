import { Router } from "express";
import { sqlite, rowToGameState } from "@workspace/db";
import { z } from "zod/v4";
import type { SQLInputValue } from "node:sqlite";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

const gameStateUpdateSchema = z.object({
  // Semantic action fields (preferred)
  action: z.enum(["start", "pause", "resume", "stop"]).optional(),
  durationMinutes: z.number().min(0).optional(),
});

function getOrCreateRow() {
  let row = sqlite.prepare("SELECT * FROM game_state LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) {
    sqlite.prepare("INSERT INTO game_state (is_game_active, is_paused, total_elapsed_sec, duration_minutes) VALUES (0, 0, 0, 0)").run();
    row = sqlite.prepare("SELECT * FROM game_state LIMIT 1").get() as Record<string, unknown>;
  }
  return row;
}

/** Compute live elapsed seconds from stored state */
function computeLiveElapsed(state: ReturnType<typeof rowToGameState>): number {
  if (state.isGameActive && !state.isPaused && state.globalStartTimestamp) {
    return state.totalElapsedSec + (Date.now() - state.globalStartTimestamp) / 1000;
  }
  return state.totalElapsedSec;
}

router.get("/game-state", (_req, res) => {
  const row = getOrCreateRow();
  const state = rowToGameState(row);
  // Return live elapsed so clients always get current time
  res.json({ ...state, totalElapsedSec: computeLiveElapsed(state) });
});

router.put("/game-state", requireAdmin, (req, res) => {
  const parsed = gameStateUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { action, durationMinutes } = parsed.data;

  const row = getOrCreateRow();
  const state = rowToGameState(row);
  const liveElapsed = computeLiveElapsed(state);

  const sets: string[] = [];
  const vals: SQLInputValue[] = [];

  const set = (col: string, val: SQLInputValue) => { sets.push(`${col} = ?`); vals.push(val); };

  if (action === "start") {
    set("is_game_active", 1);
    set("is_paused", 0);
    set("global_start_timestamp", Date.now());
    set("total_elapsed_sec", 0);
    set("last_pause_timestamp", null);
    if (durationMinutes !== undefined) set("duration_minutes", durationMinutes);
  } else if (action === "pause" && state.isGameActive && !state.isPaused) {
    set("is_paused", 1);
    set("global_start_timestamp", null);
    set("total_elapsed_sec", liveElapsed);
    set("last_pause_timestamp", Date.now());
  } else if (action === "resume" && state.isGameActive && state.isPaused) {
    set("is_paused", 0);
    set("global_start_timestamp", Date.now());
    // total_elapsed_sec already saved on pause — keep it
  } else if (action === "stop") {
    set("is_game_active", 0);
    set("is_paused", 0);
    set("global_start_timestamp", null);
    set("total_elapsed_sec", liveElapsed);
    set("last_pause_timestamp", null);
  } else if (durationMinutes !== undefined) {
    set("duration_minutes", durationMinutes);
  }

  if (sets.length) {
    sqlite.prepare(`UPDATE game_state SET ${sets.join(", ")}`).run(...vals);
  }

  const updatedRow = sqlite.prepare("SELECT * FROM game_state LIMIT 1").get() as Record<string, unknown>;
  const updatedState = rowToGameState(updatedRow);
  res.json({ ...updatedState, totalElapsedSec: computeLiveElapsed(updatedState) });
});

export default router;
