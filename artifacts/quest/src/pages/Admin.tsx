import { useState, useEffect } from "react";
import {
  useGetGameState,
  useUpdateGameState,
  useGetTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useGetPlayers,
  useResetPlayers,
  useGetQualityCodes,
  getGetGameStateQueryKey,
  getGetTasksQueryKey,
  getGetPlayersQueryKey,
  getGetQualityCodesQueryKey,
  setAuthTokenGetter,
  type Task,
  type QualityCode,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { cn, compressImage } from "@/lib/utils";
import {
  Play, Pause, Square, Plus, Trash2, Edit, Shield, Copy,
  RefreshCw, Star, Award, ChevronDown, ChevronRight, Users, AlertTriangle, Trophy, Clock,
  Camera, Check, X, Loader2, KeyRound, History, Image as ImageIcon,
} from "lucide-react";

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function copyToClipboard(text: string, label?: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`Скопировано${label ? ": " + label : ""}`));
}

// Admin login is kept in this browser's localStorage so a dropped connection,
// a phone reclaiming background tab memory, or a page reload during a live
// game doesn't force the organizer to remember and retype the password.
const ADMIN_STORAGE_KEY = "quest_admin_password";

type PhotoSubmission = {
  id: number;
  taskId: number;
  clientId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt: number | null;
  taskTitle: string;
  playerName: string;
  playerTeam: string;
};

async function fetchPhotoSubmissions(password: string): Promise<PhotoSubmission[]> {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/photo-submissions`, {
    headers: { Authorization: `Bearer ${password}` },
  });
  if (!res.ok) throw new Error("Не удалось загрузить фото на проверку");
  return res.json();
}

type CompletionLogEntry = {
  id: number;
  taskId: number;
  clientId: string;
  method: "code" | "photo";
  createdAt: number;
  taskTitle: string;
  playerName: string;
  playerTeam: string;
};

async function fetchCompletionLog(password: string): Promise<CompletionLogEntry[]> {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/completion-log`, {
    headers: { Authorization: `Bearer ${password}` },
  });
  if (!res.ok) throw new Error("Не удалось загрузить журнал выполнений");
  return res.json();
}

async function reviewPhotoSubmission(id: number, approve: boolean, password: string) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/photo-submissions/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
    body: JSON.stringify({ approve }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Ошибка сервера" }));
    throw new Error(err.error || "Ошибка при проверке фото");
  }
  return res.json();
}

const QUALITY_LABELS: Record<number, { label: string; color: string }> = {
  10: { label: "Отлично", color: "bg-emerald-500 text-white" },
  5:  { label: "Средне",  color: "bg-amber-500 text-white" },
  3:  { label: "Слабо",   color: "bg-rose-500 text-white" },
};

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_CLASSES = [
  "bg-yellow-50 border-yellow-300",
  "bg-slate-50 border-slate-300",
  "bg-orange-50 border-orange-300",
];
const PODIUM_BG = [
  "from-yellow-400 to-yellow-500",
  "from-slate-400 to-slate-500",
  "from-orange-400 to-orange-500",
];

function QualityCodesPanel({ task, allCodes }: { task: Task; allCodes: QualityCode[] }) {
  const codes = allCodes
    .filter((c) => c.taskId === task.id && c.isPermanent)
    .sort((a, b) => b.qualityPoints - a.qualityPoints);

  if (codes.length === 0) return <p className="text-xs text-muted-foreground italic px-1">Коды ещё не созданы — сохраните задание</p>;

  return (
    <div className="flex flex-col gap-2 mt-1">
      {codes.map((c) => {
        const meta = QUALITY_LABELS[c.qualityPoints] ?? { label: String(c.qualityPoints), color: "bg-slate-500 text-white" };
        return (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
              <span className="font-mono font-bold text-xl tracking-[0.2em] text-foreground select-all">{c.code}</span>
              <span className="text-sm text-muted-foreground font-medium">+{c.qualityPoints} балл{c.qualityPoints === 10 ? "ов" : c.qualityPoints === 5 ? "ов" : "а"}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => copyToClipboard(c.code, `${meta.label} (${c.qualityPoints} б.)`)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function QualityTaskRow({ task, allCodes }: { task: Task; allCodes: QualityCode[] }) {
  const [open, setOpen] = useState(false);
  const codes = allCodes.filter((c) => c.taskId === task.id && c.isPermanent);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold">{task.title}</span>
          <span className="text-sm text-muted-foreground">{task.location}</span>
        </div>
        <div className="flex items-center gap-2">
          {codes.length === 3 && codes.sort((a, b) => b.qualityPoints - a.qualityPoints).map((c) => (
            <span key={c.id} className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{c.code}</span>
          ))}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">Судья на точке называет нужный код участнику в зависимости от качества выступления.</p>
          <QualityCodesPanel task={task} allCodes={allCodes} />
        </div>
      )}
    </div>
  );
}

// Player photos require admin auth, so a plain <img src> can't fetch them (browsers don't
// attach custom headers to image requests). Fetches once per URL via react-query's cache
// and hands the browser an object URL instead — repeat renders (e.g. polling refresh of the
// surrounding list) never re-download the same photo.
function AuthedImage({ src, password, alt, className }: { src: string; password: string; alt: string; className?: string }) {
  const { data: objectUrl } = useQuery({
    queryKey: ["authed-image", src],
    queryFn: async () => {
      const res = await fetch(src, { headers: { Authorization: `Bearer ${password}` } });
      if (!res.ok) throw new Error("Не удалось загрузить фото");
      return URL.createObjectURL(await res.blob());
    },
    staleTime: Infinity,
  });
  if (!objectUrl) {
    return <div className={cn(className, "flex items-center justify-center bg-muted")}><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }
  return <img src={objectUrl} alt={alt} className={className} />;
}

export default function Admin() {
  const [password, setPassword] = useState(() => localStorage.getItem(ADMIN_STORAGE_KEY) || "");
  const [isLogged, setIsLogged] = useState(() => Boolean(localStorage.getItem(ADMIN_STORAGE_KEY)));
  const [loggingIn, setLoggingIn] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [durationInput, setDurationInput] = useState("60");
  const queryClient = useQueryClient();
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  // Restore the auth header on mount — setAuthTokenGetter lives in module memory
  // and is reset on every page load, even though isLogged/password survive via localStorage.
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (saved) setAuthTokenGetter(() => saved);
  }, []);

  const handleLogout = (message?: string) => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAuthTokenGetter(null);
    setIsLogged(false);
    setPassword("");
    if (message) toast.error(message);
  };

  const { data: gameState, error: gameStateError } = useGetGameState({
    query: { queryKey: getGetGameStateQueryKey(), refetchInterval: 2000, enabled: isLogged },
  });

  // If the saved password stops working (e.g. ADMIN_PASSWORD changed on the server),
  // drop back to the login screen instead of silently polling a 401 forever.
  useEffect(() => {
    if ((gameStateError as any)?.status === 401) {
      handleLogout("Сессия администратора истекла — войдите заново");
    }
  }, [gameStateError]);
  const { data: tasks } = useGetTasks({
    query: { queryKey: getGetTasksQueryKey(), refetchInterval: 5000, enabled: isLogged },
  });
  const { data: players } = useGetPlayers({
    query: { queryKey: getGetPlayersQueryKey(), refetchInterval: 3000, enabled: isLogged },
  });
  const { data: allCodes } = useGetQualityCodes({
    query: { queryKey: getGetQualityCodesQueryKey(), refetchInterval: 5000, enabled: isLogged },
  });
  const photoSubmissionsQueryKey = ["photo-submissions", "admin"];
  const { data: photoSubmissions } = useQuery({
    queryKey: photoSubmissionsQueryKey,
    queryFn: () => fetchPhotoSubmissions(password),
    enabled: isLogged,
    refetchInterval: 3000,
  });
  const [reviewingPhotoId, setReviewingPhotoId] = useState<number | null>(null);
  const [galleryPhoto, setGalleryPhoto] = useState<PhotoSubmission | null>(null);

  const completionLogQueryKey = ["completion-log", "admin"];
  const { data: completionLog } = useQuery({
    queryKey: completionLogQueryKey,
    queryFn: () => fetchCompletionLog(password),
    enabled: isLogged,
    refetchInterval: 4000,
  });

  const handleReviewPhoto = async (id: number, approve: boolean) => {
    setReviewingPhotoId(id);
    try {
      await reviewPhotoSubmission(id, approve, password);
      toast.success(approve ? "✅ Фото принято, задание засчитано" : "❌ Фото отклонено");
      queryClient.invalidateQueries({ queryKey: photoSubmissionsQueryKey });
      queryClient.invalidateQueries({ queryKey: getGetPlayersQueryKey() });
      queryClient.invalidateQueries({ queryKey: completionLogQueryKey });
    } catch (err: any) {
      toast.error(err.message || "Ошибка при проверке фото");
    } finally {
      setReviewingPhotoId(null);
    }
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetQualityCodesQueryKey() });
  };

  const updateGameState = useUpdateGameState({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetGameStateQueryKey() }) },
  });
  const createTask = useCreateTask({
    mutation: { onSuccess: () => { toast.success("Задание создано"); invalidateAll(); setIsTaskDialogOpen(false); } },
  });
  const updateTask = useUpdateTask({
    mutation: { onSuccess: () => { toast.success("Задание обновлено"); invalidateAll(); setIsTaskDialogOpen(false); } },
  });
  const deleteTask = useDeleteTask({
    mutation: { onSuccess: () => { toast.success("Задание удалено"); invalidateAll(); } },
  });
  const resetPlayers = useResetPlayers({
    mutation: {
      onSuccess: () => {
        toast.success("Все игроки сброшены");
        queryClient.invalidateQueries({ queryKey: getGetPlayersQueryKey() });
        setResetDialogOpen(false);
      },
      onError: () => toast.error("Ошибка при сбросе игроков"),
    },
  });

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "", location: "", correctAnswer: "", hintText: "",
    description: "", points: 10, qualityEnabled: false, photoEnabled: false, clueImageDataUrl: "",
  });
  const [clueImageUploading, setClueImageUploading] = useState(false);

  const handleOpenTaskDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({ title: task.title, location: task.location, correctAnswer: task.correctAnswer,
        hintText: task.hintText, description: task.description, points: task.points,
        qualityEnabled: task.qualityEnabled, photoEnabled: task.photoEnabled,
        clueImageDataUrl: "" });
      // The list response never carries the actual clue image (see GET /tasks) — pull it in
      // just for this edit session, so saving without touching the image doesn't erase it.
      if (task.hasClueImage) {
        fetch(`${BASE}/api/tasks/${task.id}/clue-image`)
          .then((res) => (res.ok ? res.blob() : Promise.reject()))
          .then((blob) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }))
          .then((dataUrl) => setTaskForm((prev) => ({ ...prev, clueImageDataUrl: dataUrl })))
          .catch(() => toast.error("Не удалось загрузить текущую фото-загадку"));
      }
    } else {
      setEditingTask(null);
      setTaskForm({ title: "", location: "", correctAnswer: "", hintText: "", description: "", points: 10, qualityEnabled: false, photoEnabled: false, clueImageDataUrl: "" });
    }
    setIsTaskDialogOpen(true);
  };

  const handleClueImageSelected = async (file: File | undefined) => {
    if (!file) return;
    setClueImageUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setTaskForm((prev) => ({ ...prev, clueImageDataUrl: dataUrl }));
    } catch (err: any) {
      toast.error(err.message || "Не удалось загрузить изображение");
    } finally {
      setClueImageUploading(false);
    }
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...taskForm, points: Number(taskForm.points) };
    if (editingTask) updateTask.mutate({ id: editingTask.id, data });
    else createTask.mutate({ data });
  };

  // ---- Login screen ----
  if (!isLogged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="w-full max-w-sm bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <CardTitle>Доступ ограничен</CardTitle>
            <CardDescription className="text-slate-400">Введите пароль администратора</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoggingIn(true);
              try {
                // The real password lives only on the server (ADMIN_PASSWORD env var) —
                // we verify by attempting an admin-only request, never by comparing
                // against a copy baked into the client bundle.
                const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
                const res = await fetch(`${BASE}/api/completion-log`, {
                  headers: { Authorization: `Bearer ${password}` },
                });
                if (!res.ok) throw new Error();
                localStorage.setItem(ADMIN_STORAGE_KEY, password);
                setAuthTokenGetter(() => password);
                setIsLogged(true);
              } catch {
                toast.error("Неверный пароль");
              } finally {
                setLoggingIn(false);
              }
            }}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 mb-4" placeholder="••••••••" />
              <Button type="submit" className="w-full" disabled={loggingIn || !password}>
                {loggingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const qualityTasks = (tasks ?? []).filter((t) => t.qualityEnabled);
  const pendingPhotos = (photoSubmissions ?? []).filter((p) => p.status === "pending");

  // Sorted leaderboard
  const sortedPlayers = [...(players ?? [])].map((p) => {
    const compPts = (tasks ?? []).filter((t) => p.completedTasks.includes(String(t.id))).reduce((s, t) => s + t.points, 0);
    const qualPts = Object.values(p.qualityScores ?? {}).reduce((s, pts) => s + (pts as number), 0);
    return { ...p, compPts, qualPts, total: compPts + qualPts };
  }).sort((a, b) => {
    if (a.finished && b.finished) {
      const ta = a.finishTimeSec ?? Infinity;
      const tb = b.finishTimeSec ?? Infinity;
      if (ta !== tb) return ta - tb;
    }
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (b.total !== a.total) return b.total - a.total;
    return 0;
  });

  const showWinners = !gameState?.isGameActive && sortedPlayers.length > 0;
  const top3 = sortedPlayers.slice(0, 3);

  // Live timer for admin
  const liveElapsed = gameState?.totalElapsedSec ?? 0;
  const durationSec = (gameState?.durationMinutes ?? 0) * 60;
  const remaining = durationSec > 0 ? Math.max(0, durationSec - liveElapsed) : null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" /> Панель Управления
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm px-4 py-1">Администратор</Badge>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleLogout()}>
              Выйти
            </Button>
          </div>
        </header>

        {/* ── Winners Podium (shown after game ends) ── */}
        {showWinners && (
          <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <CardTitle className="text-xl">Итоги игры — Победители!</CardTitle>
              </div>
              <CardDescription>
                Итоговое время: {formatTime(liveElapsed)}
                {gameState?.durationMinutes ? ` из ${gameState.durationMinutes} мин` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Podium */}
              <div className="flex items-end justify-center gap-4 mb-8">
                {/* Silver (2nd) */}
                {top3[1] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-center">
                      <p className="font-bold text-sm">{top3[1].name}</p>
                      {top3[1].team && <p className="text-xs text-muted-foreground">{top3[1].team}</p>}
                      <p className="font-bold text-lg text-slate-600">{top3[1].total} б.</p>
                      {top3[1].finishTimeSec && <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><Clock className="w-3 h-3"/>{formatTime(top3[1].finishTimeSec)}</p>}
                    </div>
                    <div className={`w-24 h-20 bg-gradient-to-t ${PODIUM_BG[1]} rounded-t-xl flex items-center justify-center text-white text-3xl font-bold shadow-md`}>
                      🥈
                    </div>
                  </div>
                )}
                {/* Gold (1st) */}
                {top3[0] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-center">
                      <p className="font-bold text-base">{top3[0].name}</p>
                      {top3[0].team && <p className="text-xs text-muted-foreground">{top3[0].team}</p>}
                      <p className="font-bold text-xl text-yellow-600">{top3[0].total} б.</p>
                      {top3[0].finishTimeSec && <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><Clock className="w-3 h-3"/>{formatTime(top3[0].finishTimeSec)}</p>}
                    </div>
                    <div className={`w-28 h-28 bg-gradient-to-t ${PODIUM_BG[0]} rounded-t-xl flex items-center justify-center text-white text-4xl font-bold shadow-lg`}>
                      🥇
                    </div>
                  </div>
                )}
                {/* Bronze (3rd) */}
                {top3[2] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-center">
                      <p className="font-bold text-sm">{top3[2].name}</p>
                      {top3[2].team && <p className="text-xs text-muted-foreground">{top3[2].team}</p>}
                      <p className="font-bold text-lg text-orange-600">{top3[2].total} б.</p>
                      {top3[2].finishTimeSec && <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><Clock className="w-3 h-3"/>{formatTime(top3[2].finishTimeSec)}</p>}
                    </div>
                    <div className={`w-20 h-14 bg-gradient-to-t ${PODIUM_BG[2]} rounded-t-xl flex items-center justify-center text-white text-2xl font-bold shadow-md`}>
                      🥉
                    </div>
                  </div>
                )}
              </div>
              {/* Full results table */}
              {sortedPlayers.length > 3 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Остальные участники</p>
                  <div className="space-y-1">
                    {sortedPlayers.slice(3).map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2 rounded-lg bg-white border border-border">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground font-mono w-5 text-sm">{i + 4}</span>
                          <div>
                            <span className="font-medium">{p.name}</span>
                            {p.team && <span className="text-xs text-muted-foreground ml-2">{p.team}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {p.finishTimeSec && <span className="text-xs text-muted-foreground">{formatTime(p.finishTimeSec)}</span>}
                          <span className="font-bold text-primary">{p.total} б.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Game Controls ── */}
        <Card>
          <CardHeader>
            <CardTitle>Управление игрой</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Timer display */}
              <div className="text-center sm:text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {remaining !== null ? "Осталось" : "Прошло времени"}
                </div>
                <div className={`text-5xl font-mono font-bold ${remaining !== null && remaining < 300 ? "text-amber-500" : ""}`}>
                  {remaining !== null ? formatTime(remaining) : formatTime(liveElapsed)}
                </div>
                {remaining !== null && (
                  <p className="text-xs text-muted-foreground mt-1">из {gameState?.durationMinutes} мин</p>
                )}
                <div className="mt-2">
                  {gameState?.isGameActive
                    ? gameState.isPaused
                      ? <Badge className="bg-amber-500 text-white">На паузе</Badge>
                      : <Badge className="bg-emerald-500 text-white animate-pulse">Активна</Badge>
                    : <Badge variant="secondary">Остановлена</Badge>}
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-3 items-center sm:items-end w-full sm:w-auto">
                {/* Duration input — only when not running */}
                {!gameState?.isGameActive && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap shrink-0">Длительность (мин):</Label>
                    <Input
                      type="number"
                      min="0"
                      max="300"
                      value={durationInput}
                      onChange={(e) => setDurationInput(e.target.value)}
                      className="w-24 text-center font-mono"
                      placeholder="0 = без лимита"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                  {!gameState?.isGameActive ? (
                    <Button
                      size="lg"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white w-36"
                      onClick={() => updateGameState.mutate({ data: { action: "start", durationMinutes: Number(durationInput) || 0 } })}
                    >
                      <Play className="w-5 h-5 mr-2" /> Старт
                    </Button>
                  ) : (
                    <>
                      {gameState.isPaused ? (
                        <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white w-36"
                          onClick={() => updateGameState.mutate({ data: { action: "resume" } })}>
                          <Play className="w-5 h-5 mr-2" /> Продолжить
                        </Button>
                      ) : (
                        <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white w-36"
                          onClick={() => updateGameState.mutate({ data: { action: "pause" } })}>
                          <Pause className="w-5 h-5 mr-2" /> Пауза
                        </Button>
                      )}
                      <Button size="lg" variant="destructive" className="w-36"
                        onClick={() => { if (confirm("Остановить игру и показать итоги?")) updateGameState.mutate({ data: { action: "stop" } }); }}>
                        <Square className="w-5 h-5 mr-2" /> Стоп
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Photo submissions — live moderation ── */}
        {pendingPhotos.length > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                <CardTitle>Фото на проверке</CardTitle>
                <Badge className="bg-primary text-primary-foreground animate-pulse">{pendingPhotos.length}</Badge>
              </div>
              <CardDescription>Примите или отклоните фото — решение сразу видно игроку.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingPhotos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border overflow-hidden bg-background flex flex-col">
                    <AuthedImage src={`${BASE}/api/photo-submissions/${p.id}/photo`} password={password} alt={p.taskTitle} className="w-full h-48 object-cover" />
                    <div className="p-3 space-y-2 flex-1 flex flex-col">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{p.taskTitle}</p>
                        <p className="text-sm font-bold text-primary leading-tight mt-0.5">
                          {p.playerTeam || p.playerName}
                        </p>
                        {p.playerTeam && (
                          <p className="text-xs text-muted-foreground">{p.playerName}</p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-auto pt-1">
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={reviewingPhotoId === p.id}
                          onClick={() => handleReviewPhoto(p.id, true)}>
                          {reviewingPhotoId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Принять</>}
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1"
                          disabled={reviewingPhotoId === p.id}
                          onClick={() => handleReviewPhoto(p.id, false)}>
                          <X className="w-4 h-4 mr-1" /> Отклонить
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Photo album — every submitted photo, any status, for browsing/keepsake ── */}
        {(photoSubmissions ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                <CardTitle>Фотоальбом квеста</CardTitle>
                <Badge variant="secondary">{photoSubmissions?.length ?? 0}</Badge>
              </div>
              <CardDescription>Все присланные фото — и принятые, и отклонённые, и ожидающие.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...(photoSubmissions ?? [])].sort((a, b) => b.createdAt - a.createdAt).map((p) => (
                  <button key={p.id} onClick={() => setGalleryPhoto(p)}
                    className="rounded-xl border border-border overflow-hidden bg-background text-left hover:ring-2 hover:ring-primary/40 transition-all">
                    <div className="relative">
                      <AuthedImage src={`${BASE}/api/photo-submissions/${p.id}/photo`} password={password} alt={p.taskTitle} className="w-full h-32 object-cover" />
                      <Badge className={cn("absolute top-1.5 right-1.5 text-xs",
                        p.status === "approved" ? "bg-emerald-500 text-white" :
                        p.status === "rejected" ? "bg-rose-500 text-white" :
                        "bg-amber-500 text-white")}>
                        {p.status === "approved" ? "✅" : p.status === "rejected" ? "❌" : "⏳"}
                      </Badge>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold text-primary truncate">{p.playerTeam || p.playerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.taskTitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Photo lightbox ── */}
        <Dialog open={galleryPhoto !== null} onOpenChange={(open) => !open && setGalleryPhoto(null)}>
          <DialogContent className="max-w-2xl">
            {galleryPhoto && (
              <>
                <DialogHeader>
                  <DialogTitle>{galleryPhoto.taskTitle}</DialogTitle>
                </DialogHeader>
                <AuthedImage src={`${BASE}/api/photo-submissions/${galleryPhoto.id}/photo`} password={password} alt={galleryPhoto.taskTitle} className="w-full rounded-lg" />
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold text-primary">{galleryPhoto.playerTeam || galleryPhoto.playerName}</p>
                    {galleryPhoto.playerTeam && <p className="text-muted-foreground text-xs">{galleryPhoto.playerName}</p>}
                  </div>
                  <div className="text-right">
                    <Badge className={
                      galleryPhoto.status === "approved" ? "bg-emerald-500 text-white" :
                      galleryPhoto.status === "rejected" ? "bg-rose-500 text-white" :
                      "bg-amber-500 text-white"
                    }>
                      {galleryPhoto.status === "approved" ? "Принято" : galleryPhoto.status === "rejected" ? "Отклонено" : "На проверке"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(galleryPhoto.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Quality Codes by Task ── */}
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <CardTitle>Коды оценки качества</CardTitle>
            </div>
            <CardDescription>
              Для каждого задания с включённой оценкой — три постоянных кода. Судья называет нужный код участнику после выступления.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {qualityTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Нет заданий с включённой оценкой качества.</p>
                <p className="text-xs mt-1">Откройте редактор задания и включите переключатель «Оценка качества».</p>
              </div>
            ) : (
              <div className="space-y-3">
                {qualityTasks.map((task) => (
                  <QualityTaskRow key={task.id} task={task} allCodes={allCodes ?? []} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Players leaderboard ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>Команды и игроки</CardTitle>
              <Badge variant="secondary">{players?.length ?? 0}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: getGetPlayersQueryKey() })}>
                <RefreshCw className="w-4 h-4 mr-2" /> Обновить
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setResetDialogOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Сбросить игроков
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Место</TableHead>
                  <TableHead>Участник</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead className="text-center">Выполнено</TableHead>
                  <TableHead className="text-center">Баллы</TableHead>
                  <TableHead className="text-center text-primary">+ Качество</TableHead>
                  <TableHead className="text-right font-bold text-primary">Итого</TableHead>
                  <TableHead className="text-right">Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((p, idx) => {
                  const medal = MEDALS[idx];
                  const medalClass = MEDAL_CLASSES[idx] ?? "";
                  return (
                    <TableRow key={p.id} className={idx < 3 ? `${medalClass} border-l-2` : ""}>
                      <TableCell className="text-center font-bold text-xl">
                        {medal ?? <span className="text-muted-foreground text-sm font-normal">{idx + 1}</span>}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.team || "—"}</TableCell>
                      <TableCell className="text-center font-mono">{p.completedTasks.length} / {tasks?.length ?? 0}</TableCell>
                      <TableCell className="text-center">{p.compPts}</TableCell>
                      <TableCell className="text-center text-primary font-semibold">+{p.qualPts}</TableCell>
                      <TableCell className="text-right font-bold text-primary text-lg">{p.total}</TableCell>
                      <TableCell className="text-right">
                        {p.finished
                          ? <Badge className="bg-emerald-500 text-white">🏁 {p.finishTimeSec ? formatTime(p.finishTimeSec) : "Финиш"}</Badge>
                          : <Badge variant="secondary">В игре</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedPlayers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Нет зарегистрированных участников</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Completion feed — who completed what, when, and how ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <CardTitle>Лента выполнений</CardTitle>
              <Badge variant="secondary">{completionLog?.length ?? 0}</Badge>
            </div>
            <CardDescription>Кто, что и когда выполнил — код или фото.</CardDescription>
          </CardHeader>
          <CardContent>
            {(completionLog ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Пока никто не выполнил ни одного задания.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {(completionLog ?? []).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                    {entry.method === "photo"
                      ? <Camera className="w-4 h-4 text-sky-600 shrink-0" />
                      : <KeyRound className="w-4 h-4 text-primary shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-sm text-foreground">{entry.playerTeam || entry.playerName}</span>
                      {entry.playerTeam && <span className="text-xs text-muted-foreground"> · {entry.playerName}</span>}
                      <span className="text-sm text-muted-foreground"> — «{entry.taskTitle}» выполнено</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(entry.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Task list ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Задания ({tasks?.length ?? 0})</CardTitle>
            <Button onClick={() => handleOpenTaskDialog()}>
              <Plus className="w-4 h-4 mr-2" /> Добавить
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Локация</TableHead>
                  <TableHead>Код ответа</TableHead>
                  <TableHead className="text-center">Баллы</TableHead>
                  <TableHead className="text-center">Оценка качества</TableHead>
                  <TableHead className="text-center">Фото</TableHead>
                  <TableHead className="text-center">Загадка</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tasks ?? []).map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.location}</TableCell>
                    <TableCell className="font-mono">{task.correctAnswer || "—"}</TableCell>
                    <TableCell className="text-center">{task.points}</TableCell>
                    <TableCell className="text-center">
                      {task.qualityEnabled
                        ? <Badge className="bg-primary/80 text-white text-xs">Вкл</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {task.photoEnabled
                        ? <Badge className="bg-sky-500 text-white text-xs"><Camera className="w-3 h-3 mr-1" />Вкл</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {task.hasClueImage
                        ? <img src={`${BASE}/api/tasks/${task.id}/clue-image`} alt="" className="w-10 h-10 rounded object-cover inline-block" loading="lazy" />
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenTaskDialog(task)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Удалить задание "${task.title}"?`)) deleteTask.mutate({ id: task.id }); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(tasks ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Нет заданий</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Reset Players Dialog ── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Сбросить всех игроков?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground space-y-2">
            <p>Это действие удалит <strong className="text-foreground">всех {players?.length ?? 0} зарегистрированных игроков</strong> и их прогресс.</p>
            <p>Действие необратимо. Убедитесь, что записали результаты перед сбросом.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={() => resetPlayers.mutate()} disabled={resetPlayers.isPending}>
              {resetPlayers.isPending ? "Сброс..." : "Удалить всех игроков"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Task Edit/Create Dialog ── */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Редактировать задание" : "Новое задание"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTask}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Локация</Label>
                <Input value={taskForm.location} onChange={(e) => setTaskForm({ ...taskForm, location: e.target.value })} />
              </div>
              {!taskForm.photoEnabled && (
                <div className="space-y-2">
                  <Label>Код ответа *</Label>
                  <Input required value={taskForm.correctAnswer} onChange={(e) => setTaskForm({ ...taskForm, correctAnswer: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Подсказка</Label>
                <Input value={taskForm.hintText} onChange={(e) => setTaskForm({ ...taskForm, hintText: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Баллы за выполнение</Label>
                <Input type="number" min="0" value={taskForm.points}
                  onChange={(e) => setTaskForm({ ...taskForm, points: Number(e.target.value) })} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Фото-загадка (опционально)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Покажется игрокам прямо в задании — например, кусок фото места, которое нужно узнать и найти.
                </p>
                {taskForm.clueImageDataUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={taskForm.clueImageDataUrl} alt="Фото-загадка" className="w-full h-40 object-cover" />
                    <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => setTaskForm((prev) => ({ ...prev, clueImageDataUrl: "" }))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className={cn(
                    "h-24 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer transition-colors",
                    clueImageUploading ? "opacity-60 pointer-events-none" : "hover:bg-muted/40"
                  )}>
                    {clueImageUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                    {clueImageUploading ? "Загрузка..." : "Прикрепить фото"}
                    <input type="file" accept="image/*" className="hidden" disabled={clueImageUploading}
                      onChange={(e) => { handleClueImageSelected(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Star className="w-4 h-4 text-primary" /> Оценка качества
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Автоматически создаёт три кода (10 / 5 / 3 балла). Судья называет нужный код участнику.
                  </p>
                </div>
                <Switch checked={taskForm.qualityEnabled} onCheckedChange={(v) => setTaskForm({ ...taskForm, qualityEnabled: v })} />
              </div>

              {taskForm.qualityEnabled && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-1.5"><Award className="w-4 h-4 text-primary" /> Три кода будут сгенерированы:</p>
                  <ul className="ml-5 list-disc space-y-0.5">
                    <li><strong>Код 1</strong> — Отлично (+10 баллов)</li>
                    <li><strong>Код 2</strong> — Средне (+5 баллов)</li>
                    <li><strong>Код 3</strong> — Слабо (+3 балла)</li>
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Camera className="w-4 h-4 text-primary" /> Фото-задание
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Вместо кода игрок прикрепляет фото. Вы принимаете или отклоняете его вручную в разделе «Фото на проверке».
                  </p>
                </div>
                <Switch checked={taskForm.photoEnabled} onCheckedChange={(v) => setTaskForm({ ...taskForm, photoEnabled: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
