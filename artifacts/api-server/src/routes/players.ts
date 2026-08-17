import { Router } from "express";
import { sqlite, rowToPlayer } from "@workspace/db";
import { z } from "zod/v4";
import type { SQLInputValue } from "node:sqlite";
import { requireAdmin } from "../middlewares/admin";
import { hashPin } from "../lib/pin";

const router = Router();

const pinSchema = z.string().regex(/^\d{4}$/, "PIN-код должен состоять из 4 цифр");

const playerInsertSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  team: z.string().optional().default(""),
  pin: pinSchema,
});

// Note: completedTasks/finished/finishTimeSec are intentionally not editable here —
// they are only ever set server-side by POST /tasks/:id/submit after verifying the
// answer code, so a player can't self-report progress they haven't actually earned.
const playerUpdateSchema = z.object({
  name: z.string().optional(),
  team: z.string().optional(),
});

const playerRecoverSchema = z.object({
  name: z.string(),
  team: z.string().optional().default(""),
  pin: pinSchema,
  newClientId: z.string(),
});

router.get("/players", (_req, res) => {
  const rows = sqlite.prepare("SELECT * FROM players ORDER BY id").all() as Record<string, unknown>[];
  res.json(rows.map(rowToPlayer));
});

router.get("/players/:clientId", (req, res) => {
  const row = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(req.params.clientId) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rowToPlayer(row));
});

router.post("/players", (req, res) => {
  const parsed = playerInsertSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    sqlite.prepare(
      "INSERT INTO players (client_id, name, team, completed_tasks, finished, finish_time_sec, pin_hash) VALUES (?, ?, ?, '[]', 0, NULL, ?)"
    ).run(d.clientId, d.name, d.team, hashPin(d.pin));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      const row = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(d.clientId) as Record<string, unknown>;
      res.json(rowToPlayer(row));
      return;
    }
    throw e;
  }
  const row = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(d.clientId) as Record<string, unknown>;
  res.json(rowToPlayer(row));
});

// POST /players/recover — find player by name+team and re-assign clientId
// Allows players to recover their session after clearing localStorage or switching devices
router.post("/players/recover", (req, res) => {
  const parsed = playerRecoverSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, team, pin, newClientId } = parsed.data;

  // Search by name (case-insensitive). If team is provided, narrow by team too.
  let row: Record<string, unknown> | undefined;
  if (team) {
    row = sqlite.prepare(
      "SELECT * FROM players WHERE LOWER(name) = LOWER(?) AND LOWER(team) = LOWER(?) LIMIT 1"
    ).get(name, team) as Record<string, unknown> | undefined;
  }
  // Fallback: search by name only (if team is empty or no match with team)
  if (!row) {
    row = sqlite.prepare(
      "SELECT * FROM players WHERE LOWER(name) = LOWER(?) LIMIT 1"
    ).get(name) as Record<string, unknown> | undefined;
  }

  if (!row) {
    res.status(404).json({ error: "Игрок с таким именем не найден. Проверьте правильность написания." });
    return;
  }

  if (row.pin_hash !== hashPin(pin)) {
    res.status(401).json({ error: "Неверный PIN-код." });
    return;
  }

  // Update client_id to the new one (re-link session)
  sqlite.prepare("UPDATE players SET client_id = ? WHERE id = ?").run(newClientId, row.id as number);
  const updated = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(newClientId) as Record<string, unknown>;
  res.json(rowToPlayer(updated));
});

router.put("/players/:clientId", (req, res) => {
  const parsed = playerUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const sets: string[] = [];
  const vals: SQLInputValue[] = [];
  if (d.name !== undefined) { sets.push("name = ?"); vals.push(d.name); }
  if (d.team !== undefined) { sets.push("team = ?"); vals.push(d.team); }
  if (!sets.length) { res.status(400).json({ error: "Nothing to update" }); return; }
  vals.push(req.params.clientId);
  sqlite.prepare(`UPDATE players SET ${sets.join(", ")} WHERE client_id = ?`).run(...vals);
  const row = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(req.params.clientId) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rowToPlayer(row));
});

// DELETE /players — reset all players (admin)
router.delete("/players", requireAdmin, (_req, res) => {
  sqlite.prepare("DELETE FROM players").run();
  sqlite.prepare("DELETE FROM photo_submissions").run();
  sqlite.prepare("DELETE FROM completion_log").run();
  res.json({ ok: true });
});

export default router;
