import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetPlayer,
  useGetTasks,
  useGetGameState,
  useRedeemQualityCode,
  getGetPlayerQueryKey,
  getGetTasksQueryKey,
  getGetGameStateQueryKey,
} from "@workspace/api-client-react";
import { getClientId, cn, compressImage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  MapPin, KeyRound, CheckCircle2, Star, Clock,
  Loader2, Lightbulb, Timer, AlertTriangle, HourglassIcon, Camera,
  Rocket, Users, Flag, RotateCcw, HelpCircle,
} from "lucide-react";

// ── Timer display ──────────────────────────────────────────────────────────────
function TimerDisplay({ gameState }: { gameState: any }) {
  const [elapsed, setElapsed] = useState<number>(gameState?.totalElapsedSec ?? 0);
  const durationSec = (gameState?.durationMinutes ?? 0) * 60;
  const isCountdown = durationSec > 0;

  // Sync from server whenever totalElapsedSec changes (server returns live value)
  useEffect(() => {
    if (gameState == null) return;
    setElapsed(gameState.totalElapsedSec);
  }, [gameState?.totalElapsedSec]);

  // Client-side 1-second tick between server polls
  useEffect(() => {
    if (!gameState?.isGameActive || gameState?.isPaused) return;
    const id = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(id);
  }, [gameState?.isGameActive, gameState?.isPaused]);

  const displaySec = isCountdown ? Math.max(0, durationSec - elapsed) : elapsed;
  const hrs = Math.floor(displaySec / 3600);
  const mins = Math.floor((displaySec % 3600) / 60);
  const secs = Math.floor(displaySec % 60);

  const isAlmostUp = isCountdown && displaySec > 0 && displaySec <= 300;
  const isTimeUp = isCountdown && displaySec <= 0;

  return (
    <div className="text-center py-3">
      {isCountdown && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {isTimeUp ? "⛔ Время вышло!" : "⏱ Осталось"}
        </p>
      )}
      <div className={cn(
        "font-mono text-5xl sm:text-6xl font-bold tracking-tight tabular-nums",
        isTimeUp ? "text-destructive" :
        isAlmostUp ? "text-amber-500 animate-pulse" :
        gameState?.isGameActive && !gameState?.isPaused ? "text-primary" : "text-muted-foreground opacity-70"
      )}>
        {hrs > 0 && <>{hrs}:</>}{mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
      </div>
      {isCountdown && !isTimeUp && (
        <p className="text-xs text-muted-foreground mt-1">из {gameState.durationMinutes} мин</p>
      )}
    </div>
  );
}

// ── Pre-game waiting screen — doubles as a plain-language "how this works" guide ──
const HOW_IT_WORKS_STEPS = [
  {
    icon: Rocket,
    title: "Организатор нажмёт «Старт»",
    text: "Как только игра начнётся, здесь сразу появится список всех заданий — ничего обновлять не нужно.",
  },
  {
    icon: MapPin,
    title: "Найдите место на карточке задания",
    text: "У каждого задания указана локация — куда идти. Прочитайте описание и подсказку прямо там же.",
  },
  {
    icon: Users,
    title: "На месте вас встретит организатор",
    text: "Он в фирменной футболке с логотипом клуба. Подскажет, что делать, и выдаст код или примет фото.",
  },
  {
    icon: KeyRound,
    title: "Есть поле для кода — введите цифры",
    text: "Код узнаёте на месте у организатора. Впишите его в поле и нажмите кнопку с ключиком.",
  },
  {
    icon: Camera,
    title: "Есть кнопка камеры — вместо кода снимите фото",
    text: "Сфотографируйте нужный момент и отправьте. Организатор проверит фото прямо во время игры и сразу подтвердит его — или попросит переснять.",
  },
  {
    icon: Star,
    title: "Иногда после задания появляется поле для бонуса",
    text: "Судья на месте оценит выступление и назовёт код — введите его, чтобы получить дополнительные баллы.",
  },
  {
    icon: Clock,
    title: "Следите за таймером наверху",
    text: "Если время игры ограничено, там будет виден обратный отсчёт — сколько осталось.",
  },
  {
    icon: Flag,
    title: "Выполнили всё — возвращайтесь на старт",
    text: "Организатор остановит игру и покажет итоги и победителей на подиуме.",
  },
];

function WaitingScreen({ player }: { player: any }) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  return (
    <div className="min-h-[100dvh] bg-background px-4 pb-16">
      <div className="max-w-2xl mx-auto">
        <img src={`${BASE}/logo.svg`} alt="Surgut Smotra" className="w-40 sm:w-48 mx-auto pt-6 pb-2" />

        {/* ── Waiting header ── */}
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center ring-8 ring-primary/5 animate-pulse">
            <HourglassIcon className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold">{player.name}</h1>
            {player.team && <p className="text-muted-foreground text-sm">{player.team}</p>}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Ожидайте старта игры</p>
            <p className="text-sm text-muted-foreground mt-0.5">Пока ждёте — прочитайте, как всё устроено 👇</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>

        {/* ── How it works, step by step ── */}
        <Card className="border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" /> Как всё устроено
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {HOW_IT_WORKS_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <div key={i} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <StepIcon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-semibold text-sm leading-snug">{step.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{step.text}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Quick tip: recovering a lost session ── */}
        <Card className="mt-4 border-amber-200 bg-amber-50/60">
          <CardContent className="flex gap-3 py-4">
            <RotateCcw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-900">Закрыли вкладку или сменили телефон?</p>
              <p className="text-sm text-amber-800/90 leading-relaxed mt-0.5">
                Откройте ссылку заново и на стартовом экране нажмите «Восстановить сессию» — введите то же имя,
                команду и свой PIN-код. Весь прогресс вернётся, ничего не потеряется.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Submits an answer code for server-side verification — the correct code is never sent to the client. */
async function submitTaskAnswer(taskId: number, answer: string, clientId: string): Promise<{ correct: boolean }> {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/tasks/${taskId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, answer }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Ошибка сервера" }));
    throw new Error(err.error || "Ошибка при отправке кода");
  }
  return res.json();
}

type MyPhotoSubmission = {
  id: number;
  taskId: number;
  status: "pending" | "approved" | "rejected";
};

async function fetchMyPhotoSubmissions(clientId: string): Promise<MyPhotoSubmission[]> {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/photo-submissions?clientId=${encodeURIComponent(clientId)}`);
  if (!res.ok) throw new Error("Не удалось получить статус фото");
  return res.json();
}

async function uploadTaskPhoto(taskId: number, clientId: string, photoDataUrl: string): Promise<void> {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/photo-submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, clientId, photoDataUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Ошибка сервера" }));
    throw new Error(err.error || "Ошибка при отправке фото");
  }
}

// ── Photo task control (camera upload + review status) ─────────────────────────
function PhotoTaskControl({ status, uploading, onSelect }: {
  status?: "pending" | "rejected";
  uploading: boolean;
  onSelect: (file: File | undefined) => void;
}) {
  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        Фото отправлено, ожидает проверки организатором
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {status === "rejected" && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Фото отклонено — попробуйте снять ещё раз
        </p>
      )}
      <label className={cn(
        "h-11 flex items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium transition-colors cursor-pointer",
        uploading ? "opacity-60 pointer-events-none" : "hover:bg-muted/50"
      )}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {uploading ? "Отправка..." : "Прикрепить фото"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={(e) => { onSelect(e.target.files?.[0]); e.target.value = ""; }}
        />
      </label>
    </div>
  );
}

// ── Main Game component ────────────────────────────────────────────────────────
export default function Game() {
  const [, setLocation] = useLocation();
  const clientId = getClientId();
  const queryClient = useQueryClient();

  const { data: player, isError: playerError, isLoading: playerLoading } = useGetPlayer(clientId, {
    query: { queryKey: getGetPlayerQueryKey(clientId), retry: false, refetchInterval: 5000 }
  });
  const { data: tasks, isLoading: tasksLoading } = useGetTasks({
    query: { queryKey: getGetTasksQueryKey(), refetchInterval: 10000 }
  });
  const { data: gameState } = useGetGameState({
    query: { queryKey: getGetGameStateQueryKey(), refetchInterval: 3000 }
  });

  const redeemCode = useRedeemQualityCode();

  const photoSubmissionsQueryKey = ["photo-submissions", "mine", clientId];
  const { data: myPhotoSubmissions } = useQuery({
    queryKey: photoSubmissionsQueryKey,
    queryFn: () => fetchMyPhotoSubmissions(clientId),
    refetchInterval: 4000,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qualityCodes, setQualityCodes] = useState<Record<string, string>>({});
  const [submittingTaskId, setSubmittingTaskId] = useState<number | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null);

  useEffect(() => {
    if (playerError) setLocation("/");
  }, [playerError, setLocation]);

  const handlePhotoSelected = async (taskId: number, file: File | undefined) => {
    if (!file) return;
    setUploadingTaskId(taskId);
    try {
      const photoDataUrl = await compressImage(file);
      await uploadTaskPhoto(taskId, clientId, photoDataUrl);
      toast.success("📷 Фото отправлено на проверку организатору");
      queryClient.invalidateQueries({ queryKey: photoSubmissionsQueryKey });
    } catch (err: any) {
      toast.error(err.message || "Ошибка при отправке фото");
    } finally {
      setUploadingTaskId(null);
    }
  };

  const handleTaskSubmit = async (taskId: number) => {
    if (!player) return;
    const answer = answers[taskId]?.trim();
    if (!answer) return;
    setSubmittingTaskId(taskId);
    try {
      const result = await submitTaskAnswer(taskId, answer, clientId);
      if (result.correct) {
        toast.success("✅ Код принят! Задание выполнено.");
        setAnswers(prev => ({ ...prev, [taskId]: "" }));
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(clientId) });
      } else {
        toast.error("❌ Неверный код! Попробуйте снова.");
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка при отправке кода");
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleQualitySubmit = (e: React.FormEvent, taskId: number) => {
    e.preventDefault();
    const code = qualityCodes[taskId]?.trim();
    if (!code) return;
    redeemCode.mutate({ data: { clientId, code: code.toUpperCase() } }, {
      onSuccess: () => {
        toast.success("⭐ Бонусные баллы начислены!");
        setQualityCodes(prev => ({ ...prev, [taskId]: "" }));
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(clientId) });
      },
      onError: (err: any) => toast.error(err?.data?.error || "Ошибка при активации кода"),
    });
  };

  // ── Loading ──
  if (playerLoading || tasksLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!player) return null;

  // ── Waiting for game to start ──
  if (!gameState?.isGameActive) {
    return <WaitingScreen player={player} />;
  }

  const completedCount = player.completedTasks.length;
  const totalTasks = tasks?.length ?? 0;
  const isPlayable = gameState.isGameActive && !gameState.isPaused;

  const durationSec = (gameState.durationMinutes ?? 0) * 60;
  const elapsed = gameState.totalElapsedSec ?? 0;
  const isTimeUp = durationSec > 0 && elapsed >= durationSec;

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  return (
    <div className="min-h-[100dvh] bg-background">

      {/* ── Logo ── */}
      <div className="flex justify-center pt-4 pb-1">
        <img src={`${BASE}/logo.svg`} alt="Surgut Smotra" className="w-40 sm:w-48" />
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3 gap-3">
          <div className="min-w-0">
            <p className="font-bold text-base sm:text-lg leading-tight truncate">{player.name}</p>
            {player.team && <p className="text-xs text-muted-foreground truncate">{player.team}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="font-bold text-foreground text-base">{completedCount}</span>
              <span className="text-muted-foreground text-sm">/ {totalTasks}</span>
            </div>
            <p className="text-xs text-muted-foreground">заданий</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 pb-16 space-y-5">
        {/* ── Timer ── */}
        <section>
          <TimerDisplay gameState={gameState} />
          {gameState.isPaused && (
            <p className="text-center text-sm text-amber-600 font-semibold -mt-1 mb-2">⏸ Игра на паузе</p>
          )}
          {isTimeUp && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm font-semibold mt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Время вышло! Заканчивайте и возвращайтесь на старт.
            </div>
          )}
        </section>

        {/* ── Tasks ── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2 px-1">
            <Clock className="w-4 h-4 text-primary" />
            Задания
          </h2>

          {(tasks ?? []).map((task) => {
            const isCompleted = player.completedTasks.includes(String(task.id));
            const qualityReceived = player.qualityScores?.[String(task.id)] !== undefined;

            return (
              <Card
                key={task.id}
                className={cn(
                  "transition-colors",
                  isCompleted
                    ? "border-green-500/50 bg-green-50/40 dark:bg-green-950/20"
                    : "border-border"
                )}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-snug">{task.title}</CardTitle>
                    {isCompleted && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                  {task.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="leading-tight">{task.location}</span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="px-4 pb-4 space-y-3">
                  {task.hasClueImage && (
                    <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                      <img src={`${BASE}/api/tasks/${task.id}/clue-image`} alt="Фото-загадка" className="w-full max-h-72 object-contain" loading="lazy" />
                    </div>
                  )}

                  {task.description && (
                    <p className="text-sm leading-relaxed text-foreground/80">{task.description}</p>
                  )}

                  {task.hintText && !isCompleted && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-lg flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <span className="leading-snug">{task.hintText}</span>
                    </div>
                  )}

                  {/* Code input for non-completed, non-photo tasks */}
                  {!isCompleted && isPlayable && !task.photoEnabled && (
                    <div className="flex gap-2 pt-1">
                      <Input
                        placeholder="Введите код..."
                        value={answers[task.id] || ""}
                        onChange={e => setAnswers(prev => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && handleTaskSubmit(task.id)}
                        className="font-mono text-base h-11 bg-background"
                        inputMode="numeric"
                      />
                      <Button
                        onClick={() => handleTaskSubmit(task.id)}
                        disabled={!answers[task.id]?.trim() || submittingTaskId === task.id}
                        className="h-11 w-11 shrink-0 p-0"
                      >
                        {submittingTaskId === task.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <KeyRound className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}

                  {/* Photo upload for photo-enabled tasks */}
                  {!isCompleted && isPlayable && task.photoEnabled && (
                    <PhotoTaskControl
                      status={(myPhotoSubmissions ?? []).find(s => s.taskId === task.id)?.status as "pending" | "rejected" | undefined}
                      uploading={uploadingTaskId === task.id}
                      onSelect={(file) => handlePhotoSelected(task.id, file)}
                    />
                  )}

                  {!isCompleted && !isPlayable && gameState.isGameActive && (
                    <p className="text-xs text-amber-600 font-medium">
                      ⏸ {task.photoEnabled ? "Прикрепите фото" : "Введите код"} когда игра продолжится
                    </p>
                  )}

                  {isCompleted && (
                    <div className="bg-green-500/10 text-green-700 font-medium text-sm px-3 py-2.5 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> Задание выполнено!
                    </div>
                  )}

                  {/* Quality code — only inside completed tasks with qualityEnabled */}
                  {isCompleted && task.qualityEnabled && !qualityReceived && (
                    <div className="border-t border-border/50 pt-3">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Star className="w-3 h-3 text-primary" />
                        Код оценки от судьи:
                      </p>
                      <form onSubmit={e => handleQualitySubmit(e, task.id)} className="flex gap-2">
                        <Input
                          placeholder="Код судьи..."
                          value={qualityCodes[task.id] || ""}
                          onChange={e => setQualityCodes(prev => ({ ...prev, [task.id]: e.target.value }))}
                          className="font-mono uppercase h-10 text-sm bg-muted/40"
                        />
                        <Button type="submit" size="sm" className="h-10 px-3 shrink-0"
                          disabled={!qualityCodes[task.id]?.trim() || redeemCode.isPending}>
                          {redeemCode.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "OK"}
                        </Button>
                      </form>
                    </div>
                  )}

                  {isCompleted && task.qualityEnabled && qualityReceived && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-semibold border-t border-border/50 pt-2.5">
                      <Star className="w-3.5 h-3.5 fill-primary" /> Бонус от судьи получен!
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* All done banner */}
          {completedCount > 0 && completedCount === totalTasks && (
            <div className="bg-green-500 text-white rounded-2xl px-5 py-4 text-center space-y-1 shadow-lg shadow-green-500/30">
              <p className="text-xl">🎉</p>
              <p className="font-bold text-base">Все задания выполнены!</p>
              <p className="text-sm opacity-90">Возвращайтесь на стартовую точку!</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
