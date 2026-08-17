import { sqlite, rowToPlayer, type Player, type CompletionMethod } from "@workspace/db";
import { getLiveElapsedSec } from "./game-time";

/**
 * Marks a task as completed for a player (idempotent), logs who completed it
 * and how, and auto-finishes them once every task is done. Shared by the
 * answer-code and photo-review flows so "all tasks completed" always means
 * the same thing regardless of how the last task was verified.
 */
export function completeTaskForPlayer(clientId: string, taskId: number, method: CompletionMethod): Player {
  const playerRow = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(clientId) as Record<string, unknown>;
  const player = rowToPlayer(playerRow);

  if (player.completedTasks.includes(String(taskId))) {
    return player;
  }

  const updatedCompleted = [...player.completedTasks, String(taskId)];
  const totalTasks = (sqlite.prepare("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n;
  const shouldFinish = !player.finished && totalTasks > 0 && updatedCompleted.length >= totalTasks;

  if (shouldFinish) {
    sqlite.prepare(
      "UPDATE players SET completed_tasks = ?, finished = 1, finish_time_sec = ? WHERE client_id = ?"
    ).run(JSON.stringify(updatedCompleted), getLiveElapsedSec(), clientId);
  } else {
    sqlite.prepare("UPDATE players SET completed_tasks = ? WHERE client_id = ?").run(JSON.stringify(updatedCompleted), clientId);
  }

  sqlite.prepare(
    "INSERT INTO completion_log (task_id, client_id, method, created_at) VALUES (?, ?, ?, ?)"
  ).run(taskId, clientId, method, Date.now());

  const updatedRow = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(clientId) as Record<string, unknown>;
  return rowToPlayer(updatedRow);
}
