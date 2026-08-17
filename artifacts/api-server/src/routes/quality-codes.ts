import { Router } from "express";
import { sqlite, rowToQualityCode, rowToPlayer } from "@workspace/db";
import { z } from "zod/v4";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function uniqueCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCode();
    const existing = sqlite.prepare("SELECT id FROM quality_codes WHERE code = ?").get(code);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique code");
}

const generateSchema = z.object({
  taskId: z.number().int(),
  qualityPoints: z.union([z.literal(3), z.literal(5), z.literal(10)]),
});

const redeemSchema = z.object({
  code: z.string().min(1),
  clientId: z.string().min(1),
});

// GET /quality-codes — list all (admin)
router.get("/quality-codes", requireAdmin, (_req, res) => {
  const rows = sqlite.prepare("SELECT * FROM quality_codes ORDER BY task_id, quality_points DESC, created_at DESC").all() as Record<string, unknown>[];
  res.json(rows.map(rowToQualityCode));
});

// POST /quality-codes — generate a one-time quality code (admin, for ad-hoc use)
router.post("/quality-codes", requireAdmin, (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { taskId, qualityPoints } = parsed.data;

  const task = sqlite.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const code = uniqueCode();
  const now = Date.now();
  sqlite.prepare(
    "INSERT INTO quality_codes (code, task_id, quality_points, created_at, is_permanent) VALUES (?, ?, ?, ?, 0)"
  ).run(code, taskId, qualityPoints, now);

  const row = sqlite.prepare("SELECT * FROM quality_codes WHERE code = ?").get(code) as Record<string, unknown>;
  res.json(rowToQualityCode(row));
});

// POST /quality-codes/redeem — player redeems a quality code
router.post("/quality-codes/redeem", (req, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { code, clientId } = parsed.data;

  const codeRow = sqlite
    .prepare("SELECT * FROM quality_codes WHERE code = ?")
    .get(code.toUpperCase().trim()) as Record<string, unknown> | undefined;
  if (!codeRow) { res.status(404).json({ error: "Код не найден" }); return; }

  const qc = rowToQualityCode(codeRow);

  // One-time codes: check if already used
  if (!qc.isPermanent && qc.usedByClientId) {
    res.status(409).json({ error: "Этот код уже использован" });
    return;
  }

  const playerRow = sqlite
    .prepare("SELECT * FROM players WHERE client_id = ?")
    .get(clientId) as Record<string, unknown> | undefined;
  if (!playerRow) { res.status(404).json({ error: "Игрок не найден" }); return; }

  const player = rowToPlayer(playerRow);

  // Player must have completed this task first
  if (!player.completedTasks.includes(String(qc.taskId))) {
    res.status(400).json({ error: "Сначала выполните задание, затем введите код качества" });
    return;
  }

  // Player can only receive quality points once per task
  if (player.qualityScores[String(qc.taskId)] !== undefined) {
    res.status(409).json({ error: "Оценка качества для этого задания уже получена" });
    return;
  }

  // For one-time codes: mark as used
  if (!qc.isPermanent) {
    sqlite.prepare("UPDATE quality_codes SET used_by_client_id = ? WHERE code = ?").run(clientId, qc.code);
  }

  // Add quality score to player
  const updatedScores = { ...player.qualityScores, [String(qc.taskId)]: qc.qualityPoints };
  sqlite.prepare("UPDATE players SET quality_scores = ? WHERE client_id = ?").run(
    JSON.stringify(updatedScores),
    clientId
  );

  const updatedRow = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(clientId) as Record<string, unknown>;
  res.json({
    taskId: qc.taskId,
    qualityPoints: qc.qualityPoints,
    player: rowToPlayer(updatedRow),
  });
});

// DELETE /quality-codes/:id — delete a one-time code (admin cleanup)
router.delete("/quality-codes/:id", requireAdmin, (req, res) => {
  sqlite.prepare("DELETE FROM quality_codes WHERE id = ? AND is_permanent = 0").run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
