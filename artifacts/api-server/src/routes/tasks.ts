import { Router } from "express";
import { sqlite, rowToTask, rowToQualityCode, rowToGameState } from "@workspace/db";
import { z } from "zod/v4";
import { requireAdmin, isAdminRequest } from "../middlewares/admin";
import { completeTaskForPlayer } from "../lib/complete-task";

const router = Router();

const taskSubmitSchema = z.object({
  clientId: z.string().min(1),
  answer: z.string(),
});

const MAX_CLUE_IMAGE_LENGTH = 8_000_000; // ~6MB binary as base64 data URL

const taskSchema = z.object({
  title: z.string(),
  location: z.string().optional().default(""),
  // Required for code tasks; irrelevant and skippable for photo tasks — see refine below.
  correctAnswer: z.string().optional().default(""),
  hintText: z.string().optional().default(""),
  points: z.number().int().optional().default(10),
  latitude: z.string().optional().default(""),
  longitude: z.string().optional().default(""),
  description: z.string().optional().default(""),
  qualityEnabled: z.boolean().optional().default(false),
  photoEnabled: z.boolean().optional().default(false),
  // Clue image the admin attaches — shown to every player on this task's card
  // (e.g. a cropped photo fragment they must recognize the location from).
  clueImageDataUrl: z.string().max(MAX_CLUE_IMAGE_LENGTH).refine(
    (v) => v === "" || v.startsWith("data:image/"),
    "Некорректное изображение"
  ).optional().default(""),
}).refine(
  (d) => d.photoEnabled || d.correctAnswer.trim().length > 0,
  { message: "Код ответа обязателен, если это не фото-задание", path: ["correctAnswer"] }
);

const DEFAULT_TASKS = [
  {
    title: "Задание 1. «Посвящение в сыщики»",
    location: "Памятный знак «Сургутский кремль» (у Мемориала Славы)",
    correctAnswer: "180938",
    hintText: "Организатор стоит в фирменной футболке с логотипом у крепости",
    latitude: "61.258890",
    longitude: "73.372924",
    description: "Найдите организатора у крепости в фирменной футболке. Встаньте вокруг него, покажите 5 пальцев и сфотографируйтесь вместе.",
    points: 10,
    qualityEnabled: false,
  },
  {
    title: "Задание 2. «Купеческий аудит»",
    location: "Дом купца Клепикова, ул. Просвещения, 7",
    correctAnswer: "155497",
    hintText: "Организатор покажет на цифру 7 — сделайте важные купеческие лица",
    latitude: "61.247861",
    longitude: "73.392763",
    description: "У дома стоит организатор в фирменной футболке. Покажите цифру 7 на стене, сфотографируйтесь вместе с логотипом — сделайте важные купеческие лица!",
    points: 10,
    qualityEnabled: true,
  },
  {
    title: "Задание 3. «Мостовая перекличка»",
    location: "ЖК Георгиевский (смотровая площадка)",
    correctAnswer: "128766",
    hintText: "Организатор с клубным флагом у смотровых луп",
    latitude: "61.236626",
    longitude: "73.407622",
    description: "Встаньте рядом с организатором так, чтобы флаг и логотип были видны. На счёт «три» кричите все вместе: «Сургут, мы любим тебя!» — и снимайте видео!",
    points: 10,
    qualityEnabled: true,
  },
  {
    title: "Задание 4. «Лисья стая»",
    location: "Скульптура «Чёрный лис», ул. Энергетиков, д. 2, корп. 19",
    correctAnswer: "144327",
    hintText: "Организатор в футболке у скульптуры лиса",
    latitude: "61.243873",
    longitude: "73.365471",
    description: "Повторите позу лиса вместе с организатором — уши пальцами! Сделайте смешное фото для истории.",
    points: 10,
    qualityEnabled: false,
  },
  {
    title: "Задание 5. «Колокольный дуэт»",
    location: "Храм Преображения Господня, ул. Мелик-Карамова",
    correctAnswer: "111189",
    hintText: "Организатор с диктофоном у храма",
    latitude: "61.271597",
    longitude: "73.393961",
    description: "Запишите дуэт: организатор говорит «БОМ!», вы повторяете. Слушайте, у кого бас круче! Снимайте на видео.",
    points: 10,
    qualityEnabled: false,
  },
  {
    title: "Задание 6. «Парковый кроссворд»",
    location: "Парк нефтяников",
    correctAnswer: "167545",
    hintText: "Организатор с кроссвордом в парке",
    latitude: "61.253754",
    longitude: "73.395178",
    description: "Получите кроссворд у организатора и заполните его вместе с командой. Сдайте на проверку — чем правильнее, тем больше баллов!",
    points: 10,
    qualityEnabled: true,
  },
  {
    title: "Задание 7. «Знаток иностранного»",
    location: "Биг Бен",
    correctAnswer: "143665",
    hintText: "Организатор оценивает произношение и скорость",
    latitude: "61.259576",
    longitude: "73.357335",
    description: "Прочитайте четверостишье вслух:\n\nOne, two, three,\nLook and see —\nLife is good,\nJust like me!\n\nОрганизатор оценит произношение и скорость.",
    points: 10,
    qualityEnabled: true,
  },
  {
    title: "Задание 8. «Художник с логотипом»",
    location: "Стела с гербом Сургута (у администрации)",
    correctAnswer: "125698",
    hintText: "Организатор покажет, как рисовать лису пальцем в воздухе",
    latitude: "61.261119",
    longitude: "73.430893",
    description: "Рисуйте лису пальцем в воздухе вместе с организатором: уши, морду, хвост. Все повторяют — снимайте на видео!",
    points: 10,
    qualityEnabled: false,
  },
  {
    title: "Задание 9. «Супергеройский финал»",
    location: "Мемориал Славы (Вечный огонь)",
    correctAnswer: "198762",
    hintText: "Организатор с флагом у Вечного огня",
    latitude: "61.256956",
    longitude: "73.419157",
    description: "Встаньте лицом к огню, спиной к камере — отдайте честь и уважение погибшим. Поднимите мирный знак вверх вместе с организатором. Снимайте героическое фото!",
    points: 10,
    qualityEnabled: false,
  },
  {
    title: "Задание 10. «ФИНАЛ — Клубное братство»",
    location: "Стартовая точка",
    correctAnswer: "ФИНАЛ",
    hintText: "Главный организатор с флагом и призами",
    latitude: "61.250004",
    longitude: "73.412117",
    description: "Все команды собираются у старта. Главный организатор в фирменной футболке, с клубным флагом. Сделайте общее финальное фото с флагом клуба!",
    points: 10,
    qualityEnabled: false,
  },
];

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

/** Creates three permanent quality codes (10/5/3) for a task, if not already present */
function ensurePermanentCodes(taskId: number) {
  const existing = sqlite
    .prepare("SELECT quality_points FROM quality_codes WHERE task_id = ? AND is_permanent = 1")
    .all(taskId) as { quality_points: number }[];
  const existingLevels = new Set(existing.map((r) => r.quality_points));
  const now = Date.now();
  for (const pts of [10, 5, 3] as const) {
    if (!existingLevels.has(pts)) {
      const code = uniqueCode();
      sqlite
        .prepare(
          "INSERT INTO quality_codes (code, task_id, quality_points, created_at, is_permanent) VALUES (?, ?, ?, ?, 1)"
        )
        .run(code, taskId, pts, now);
    }
  }
}

/** Removes all permanent quality codes for a task */
function removePermanentCodes(taskId: number) {
  sqlite
    .prepare("DELETE FROM quality_codes WHERE task_id = ? AND is_permanent = 1")
    .run(taskId);
}

router.get("/tasks", (req, res) => {
  const count = (sqlite.prepare("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n;
  if (count === 0) {
    const insert = sqlite.prepare(
      "INSERT INTO tasks (title, location, correct_answer, hint_text, latitude, longitude, description, points, quality_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const t of DEFAULT_TASKS) {
      const result = insert.run(
        t.title, t.location, t.correctAnswer, t.hintText,
        t.latitude, t.longitude, t.description, t.points, t.qualityEnabled ? 1 : 0
      ) as { lastInsertRowid: number };
      if (t.qualityEnabled) {
        ensurePermanentCodes(result.lastInsertRowid);
      }
    }
  }
  const rows = sqlite.prepare("SELECT * FROM tasks ORDER BY id").all() as Record<string, unknown>[];
  const tasks = rows.map(rowToTask);
  // Never leak the answer codes to players — only an authenticated admin sees them.
  const admin = isAdminRequest(req);
  res.json(admin ? tasks : tasks.map((t) => ({ ...t, correctAnswer: "" })));
});

// POST /tasks/:id/submit — player submits an answer code; verified server-side.
router.post("/tasks/:id/submit", (req, res) => {
  const taskId = Number(req.params.id);
  const parsed = taskSubmitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { clientId, answer } = parsed.data;

  const gameRow = sqlite.prepare("SELECT * FROM game_state LIMIT 1").get() as Record<string, unknown> | undefined;
  const gameState = gameRow ? rowToGameState(gameRow) : null;
  if (!gameState?.isGameActive || gameState.isPaused) {
    res.status(400).json({ error: "Игра сейчас не активна" });
    return;
  }

  const taskRow = sqlite.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
  if (!taskRow) { res.status(404).json({ error: "Задание не найдено" }); return; }
  const task = rowToTask(taskRow);

  const playerRow = sqlite.prepare("SELECT * FROM players WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
  if (!playerRow) { res.status(404).json({ error: "Игрок не найден" }); return; }

  const correct = answer.trim().toLowerCase() === task.correctAnswer.trim().toLowerCase();
  if (!correct) { res.json({ correct: false }); return; }

  res.json({ correct: true, player: completeTaskForPlayer(clientId, taskId, "code") });
});

router.post("/tasks", requireAdmin, (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const result = sqlite.prepare(
    "INSERT INTO tasks (title, location, correct_answer, hint_text, latitude, longitude, description, points, quality_enabled, photo_enabled, clue_image_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(d.title, d.location, d.correctAnswer, d.hintText, d.latitude, d.longitude, d.description, d.points, d.qualityEnabled ? 1 : 0, d.photoEnabled ? 1 : 0, d.clueImageDataUrl) as { lastInsertRowid: number };
  const taskId = result.lastInsertRowid;
  if (d.qualityEnabled) ensurePermanentCodes(taskId);
  const row = sqlite.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown>;
  res.json(rowToTask(row));
});

router.put("/tasks/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  sqlite.prepare(
    "UPDATE tasks SET title=?, location=?, correct_answer=?, hint_text=?, latitude=?, longitude=?, description=?, points=?, quality_enabled=?, photo_enabled=?, clue_image_data=? WHERE id=?"
  ).run(d.title, d.location, d.correctAnswer, d.hintText, d.latitude, d.longitude, d.description, d.points, d.qualityEnabled ? 1 : 0, d.photoEnabled ? 1 : 0, d.clueImageDataUrl, id);
  if (d.qualityEnabled) {
    ensurePermanentCodes(id);
  } else {
    removePermanentCodes(id);
  }
  const row = sqlite.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown>;
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rowToTask(row));
});

router.delete("/tasks/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  removePermanentCodes(id);
  sqlite.prepare("DELETE FROM photo_submissions WHERE task_id = ?").run(id);
  sqlite.prepare("DELETE FROM completion_log WHERE task_id = ?").run(id);
  sqlite.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  res.json({ ok: true });
});

export { rowToQualityCode };
export default router;
