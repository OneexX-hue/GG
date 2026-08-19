import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "quest.db");

export const sqlite = new DatabaseSync(dbPath);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    correct_answer TEXT NOT NULL DEFAULT '',
    hint_text TEXT NOT NULL DEFAULT '',
    latitude TEXT NOT NULL DEFAULT '',
    longitude TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL DEFAULT 10,
    quality_enabled INTEGER NOT NULL DEFAULT 0,
    photo_enabled INTEGER NOT NULL DEFAULT 0,
    clue_image_data TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    team TEXT NOT NULL DEFAULT '',
    completed_tasks TEXT NOT NULL DEFAULT '[]',
    quality_scores TEXT NOT NULL DEFAULT '{}',
    finished INTEGER NOT NULL DEFAULT 0,
    finish_time_sec REAL,
    pin_hash TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_game_active INTEGER NOT NULL DEFAULT 0,
    is_paused INTEGER NOT NULL DEFAULT 0,
    global_start_timestamp REAL,
    total_elapsed_sec REAL NOT NULL DEFAULT 0,
    last_pause_timestamp REAL,
    duration_minutes REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS quality_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    task_id INTEGER NOT NULL,
    quality_points INTEGER NOT NULL,
    used_by_client_id TEXT,
    created_at REAL NOT NULL,
    is_permanent INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS photo_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    photo_data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at REAL NOT NULL,
    reviewed_at REAL
  );
  CREATE TABLE IF NOT EXISTS completion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    method TEXT NOT NULL,
    created_at REAL NOT NULL
  );
`);

// Migrate existing tables — add columns if missing
const migrations = [
  `ALTER TABLE players ADD COLUMN quality_scores TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE tasks ADD COLUMN quality_enabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE tasks ADD COLUMN photo_enabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE quality_codes ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE game_state ADD COLUMN duration_minutes REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN pin_hash TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE tasks ADD COLUMN clue_image_data TEXT NOT NULL DEFAULT ''`,
];
for (const sql of migrations) {
  try { sqlite.exec(sql); } catch { /* column already exists */ }
}

export type Task = {
  id: number;
  title: string;
  location: string;
  correctAnswer: string;
  hintText: string;
  latitude: string;
  longitude: string;
  description: string;
  points: number;
  qualityEnabled: boolean;
  photoEnabled: boolean;
  /** Clue image the admin attaches when creating the task — shown to players, e.g. a cropped puzzle-piece photo they must identify the location from. */
  clueImageDataUrl: string;
};

export type PhotoSubmissionStatus = "pending" | "approved" | "rejected";

export type PhotoSubmission = {
  id: number;
  taskId: number;
  clientId: string;
  photoDataUrl: string;
  status: PhotoSubmissionStatus;
  createdAt: number;
  reviewedAt: number | null;
};

export type CompletionMethod = "code" | "photo";

export type CompletionLogEntry = {
  id: number;
  taskId: number;
  clientId: string;
  method: CompletionMethod;
  createdAt: number;
};

export type Player = {
  id: number;
  clientId: string;
  name: string;
  team: string;
  completedTasks: string[];
  qualityScores: Record<string, number>;
  finished: boolean;
  finishTimeSec: number | null;
};

export type GameState = {
  id: number;
  isGameActive: boolean;
  isPaused: boolean;
  globalStartTimestamp: number | null;
  totalElapsedSec: number;
  lastPauseTimestamp: number | null;
  durationMinutes: number;
};

export type QualityCode = {
  id: number;
  code: string;
  taskId: number;
  qualityPoints: number;
  usedByClientId: string | null;
  createdAt: number;
  isPermanent: boolean;
};

export function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as number,
    title: row.title as string,
    location: row.location as string,
    correctAnswer: row.correct_answer as string,
    hintText: row.hint_text as string,
    latitude: row.latitude as string,
    longitude: row.longitude as string,
    description: row.description as string,
    points: row.points as number,
    qualityEnabled: Boolean(row.quality_enabled),
    photoEnabled: Boolean(row.photo_enabled),
    clueImageDataUrl: (row.clue_image_data as string) || "",
  };
}

export function rowToPhotoSubmission(row: Record<string, unknown>): PhotoSubmission {
  return {
    id: row.id as number,
    taskId: row.task_id as number,
    clientId: row.client_id as string,
    photoDataUrl: row.photo_data as string,
    status: row.status as PhotoSubmissionStatus,
    createdAt: row.created_at as number,
    reviewedAt: row.reviewed_at != null ? (row.reviewed_at as number) : null,
  };
}

export function rowToCompletionLogEntry(row: Record<string, unknown>): CompletionLogEntry {
  return {
    id: row.id as number,
    taskId: row.task_id as number,
    clientId: row.client_id as string,
    method: row.method as CompletionMethod,
    createdAt: row.created_at as number,
  };
}

export function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as number,
    clientId: row.client_id as string,
    name: row.name as string,
    team: row.team as string,
    completedTasks: JSON.parse((row.completed_tasks as string) || "[]"),
    qualityScores: JSON.parse((row.quality_scores as string) || "{}"),
    finished: Boolean(row.finished),
    finishTimeSec: row.finish_time_sec != null ? (row.finish_time_sec as number) : null,
  };
}

export function rowToGameState(row: Record<string, unknown>): GameState {
  return {
    id: row.id as number,
    isGameActive: Boolean(row.is_game_active),
    isPaused: Boolean(row.is_paused),
    globalStartTimestamp: row.global_start_timestamp != null ? (row.global_start_timestamp as number) : null,
    totalElapsedSec: row.total_elapsed_sec as number,
    lastPauseTimestamp: row.last_pause_timestamp != null ? (row.last_pause_timestamp as number) : null,
    durationMinutes: (row.duration_minutes as number) || 0,
  };
}

export function rowToQualityCode(row: Record<string, unknown>): QualityCode {
  return {
    id: row.id as number,
    code: row.code as string,
    taskId: row.task_id as number,
    qualityPoints: row.quality_points as number,
    usedByClientId: row.used_by_client_id as string | null,
    createdAt: row.created_at as number,
    isPermanent: Boolean(row.is_permanent),
  };
}
