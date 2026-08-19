import { Router } from "express";
import { sqlite, rowToTask, rowToGameState, rowToPhotoSubmission } from "@workspace/db";
import { z } from "zod/v4";
import { requireAdmin, isAdminRequest } from "../middlewares/admin";
import { completeTaskForPlayer } from "../lib/complete-task";

const router = Router();

const MAX_PHOTO_LENGTH = 8_000_000; // ~6MB binary as base64 data URL

const submitSchema = z.object({
  taskId: z.number().int(),
  clientId: z.string().min(1),
  photoDataUrl: z.string().min(1).max(MAX_PHOTO_LENGTH).startsWith("data:image/"),
});

const reviewSchema = z.object({
  approve: z.boolean(),
});

// POST /photo-submissions — player uploads a photo for a photo-enabled task.
router.post("/photo-submissions", (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { taskId, clientId, photoDataUrl } = parsed.data;

  const gameRow = sqlite.prepare("SELECT * FROM game_state LIMIT 1").get() as Record<string, unknown> | undefined;
  const gameState = gameRow ? rowToGameState(gameRow) : null;
  if (!gameState?.isGameActive || gameState.isPaused) {
    res.status(400).json({ error: "Игра сейчас не активна" });
    return;
  }

  const taskRow = sqlite.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
  if (!taskRow) { res.status(404).json({ error: "Задание не найдено" }); return; }
  const task = rowToTask(taskRow);
  if (!task.photoEnabled) { res.status(400).json({ error: "Это задание не принимает фото" }); return; }

  const playerRow = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
  if (!playerRow) { res.status(404).json({ error: "Игрок не найден" }); return; }
  const completedTasks = JSON.parse((playerRow.completed_tasks as string) || "[]") as string[];
  if (completedTasks.includes(String(taskId))) {
    res.status(409).json({ error: "Задание уже выполнено" });
    return;
  }

  // Replace any previous (pending/rejected) submission for this task+player.
  sqlite.prepare("DELETE FROM photo_submissions WHERE task_id = ? AND client_id = ?").run(taskId, clientId);
  const now = Date.now();
  sqlite.prepare(
    "INSERT INTO photo_submissions (task_id, client_id, photo_data, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).run(taskId, clientId, photoDataUrl, now);

  const row = sqlite.prepare(
    "SELECT * FROM photo_submissions WHERE task_id = ? AND client_id = ?"
  ).get(taskId, clientId) as Record<string, unknown>;
  res.json(rowToPhotoSubmission(row));
});

// GET /photo-submissions — metadata only, never the photo bytes: this list is polled
// every few seconds and the photo history grows unbounded over a game, so embedding
// base64 photos here would re-transfer megabytes on every poll. Actual bytes come from
// GET /photo-submissions/:id/photo, fetched once per photo and cached by the client.
router.get("/photo-submissions", (req, res) => {
  if (isAdminRequest(req)) {
    const rows = sqlite.prepare(
      `SELECT ps.*, t.title AS task_title, p.name AS player_name, p.team AS player_team
       FROM photo_submissions ps
       JOIN tasks t ON t.id = ps.task_id
       JOIN players p ON p.client_id = ps.client_id
       ORDER BY (ps.status = 'pending') DESC, ps.created_at DESC`
    ).all() as Record<string, unknown>[];
    res.json(rows.map((row) => {
      const { photoDataUrl: _omit, ...rest } = rowToPhotoSubmission(row);
      return {
        ...rest,
        taskTitle: row.task_title as string,
        playerName: row.player_name as string,
        playerTeam: row.player_team as string,
      };
    }));
    return;
  }

  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : null;
  if (!clientId) { res.status(401).json({ error: "Требуется clientId или авторизация администратора" }); return; }

  const rows = sqlite.prepare(
    "SELECT * FROM photo_submissions WHERE client_id = ? ORDER BY created_at DESC"
  ).all(clientId) as Record<string, unknown>[];
  res.json(rows.map((row) => {
    const { photoDataUrl: _omit, ...rest } = rowToPhotoSubmission(row);
    return rest;
  }));
});

// GET /photo-submissions/:id/photo — admin-only, serves the raw photo bytes.
router.get("/photo-submissions/:id/photo", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = sqlite.prepare("SELECT photo_data FROM photo_submissions WHERE id = ?").get(id) as
    | { photo_data?: string }
    | undefined;
  const match = /^data:([^;]+);base64,(.+)$/.exec(row?.photo_data ?? "");
  if (!match) { res.status(404).end(); return; }
  res.setHeader("Content-Type", match[1]);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(Buffer.from(match[2], "base64"));
});

// POST /photo-submissions/:id/review — admin approves or rejects a pending photo.
router.post("/photo-submissions/:id/review", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { approve } = parsed.data;

  const row = sqlite.prepare("SELECT * FROM photo_submissions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: "Заявка не найдена" }); return; }
  const submission = rowToPhotoSubmission(row);

  if (submission.status !== "pending") {
    res.json({ submission });
    return;
  }

  const status = approve ? "approved" : "rejected";
  sqlite.prepare("UPDATE photo_submissions SET status = ?, reviewed_at = ? WHERE id = ?").run(status, Date.now(), id);
  const updatedRow = sqlite.prepare("SELECT * FROM photo_submissions WHERE id = ?").get(id) as Record<string, unknown>;
  const updatedSubmission = rowToPhotoSubmission(updatedRow);

  if (!approve) {
    res.json({ submission: updatedSubmission });
    return;
  }

  const player = completeTaskForPlayer(submission.clientId, submission.taskId, "photo");
  res.json({ submission: updatedSubmission, player });
});

export default router;
