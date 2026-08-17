import { Router } from "express";
import { sqlite } from "@workspace/db";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

// GET /completion-log — admin-only feed of who completed what, when, and how.
router.get("/completion-log", requireAdmin, (_req, res) => {
  const rows = sqlite.prepare(
    `SELECT cl.id, cl.task_id, cl.client_id, cl.method, cl.created_at,
            t.title AS task_title, p.name AS player_name, p.team AS player_team
     FROM completion_log cl
     JOIN tasks t ON t.id = cl.task_id
     JOIN players p ON p.client_id = cl.client_id
     ORDER BY cl.created_at DESC
     LIMIT 200`
  ).all() as Record<string, unknown>[];

  res.json(rows.map((row) => ({
    id: row.id as number,
    taskId: row.task_id as number,
    clientId: row.client_id as string,
    method: row.method as string,
    createdAt: row.created_at as number,
    taskTitle: row.task_title as string,
    playerName: row.player_name as string,
    playerTeam: row.player_team as string,
  })));
});

export default router;
