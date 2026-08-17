import { sqlite, rowToGameState } from "@workspace/db";

/** Live elapsed game seconds, computed from the stored game_state row. */
export function getLiveElapsedSec(): number {
  const row = sqlite.prepare("SELECT * FROM game_state LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) return 0;
  const state = rowToGameState(row);
  if (state.isGameActive && !state.isPaused && state.globalStartTimestamp) {
    return state.totalElapsedSec + (Date.now() - state.globalStartTimestamp) / 1000;
  }
  return state.totalElapsedSec;
}
