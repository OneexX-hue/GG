import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreatePlayer, useGetPlayer, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { getClientId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Target, Loader2, RotateCcw, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Screen = "register" | "recover";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

async function recoverSession(name: string, team: string, pin: string, newClientId: string) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${BASE}/api/players/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, team, pin, newClientId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Ошибка сервера" }));
    throw new Error(err.error || "Ошибка при восстановлении");
  }
  return res.json();
}

export default function Registration() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [pin, setPin] = useState("");
  const [screen, setScreen] = useState<Screen>("register");
  const [recoverName, setRecoverName] = useState("");
  const [recoverTeam, setRecoverTeam] = useState("");
  const [recoverPin, setRecoverPin] = useState("");
  const [recoverPending, setRecoverPending] = useState(false);
  const [, setLocation] = useLocation();
  const clientId = getClientId();

  const { data: player, isLoading } = useGetPlayer(clientId, {
    query: { queryKey: getGetPlayerQueryKey(clientId), retry: false }
  });

  const createPlayer = useCreatePlayer();

  useEffect(() => {
    if (player) setLocation("/game");
  }, [player, setLocation]);

  const onRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || pin.length !== 4) return;
    createPlayer.mutate({ data: { clientId, name: name.trim(), team: team.trim(), pin } }, {
      onSuccess: () => setLocation("/game"),
      onError: () => toast.error("Ошибка при регистрации. Попробуйте ещё раз."),
    });
  };

  const onRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverName.trim() || recoverPin.length !== 4) return;
    setRecoverPending(true);
    try {
      await recoverSession(recoverName.trim(), recoverTeam.trim(), recoverPin, clientId);
      toast.success("Сессия восстановлена!");
      setLocation("/game");
    } catch (err: any) {
      toast.error(err.message || "Не удалось найти игрока");
    } finally {
      setRecoverPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <img src={`${BASE}/logo.svg`} alt="Surgut Smotra" className="w-56 sm:w-64 mx-auto mb-6" />

        {/* ── Register screen ── */}
        {screen === "register" && (
          <Card className="border-primary/20 shadow-xl shadow-primary/5">
            <CardHeader className="text-center space-y-3 pb-6">
              <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center ring-8 ring-primary/5">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">Операция: Квест</CardTitle>
                <CardDescription className="text-sm sm:text-base">Введите данные для участия</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={onRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Имя / Позывной *
                  </Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Агент 007"
                    className="h-12 text-base px-4 bg-muted/50"
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Команда (опционально)
                  </Label>
                  <Input
                    id="team"
                    value={team}
                    onChange={e => setTeam(e.target.value)}
                    placeholder="Альфа"
                    className="h-12 text-base px-4 bg-muted/50"
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Придумайте PIN-код *
                  </Label>
                  <Input
                    id="pin"
                    required
                    value={pin}
                    onChange={e => setPin(digitsOnly(e.target.value))}
                    placeholder="0000"
                    inputMode="numeric"
                    autoComplete="off"
                    className="h-12 text-base px-4 bg-muted/50 font-mono tracking-[0.3em]"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    Запомните его — понадобится для восстановления сессии на другом устройстве
                  </p>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold h-13 mt-2"
                  disabled={createPlayer.isPending || !name.trim() || pin.length !== 4}
                >
                  {createPlayer.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Регистрация...</>
                  ) : "Участвовать"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground">или</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full h-11 text-sm"
                onClick={() => setScreen("recover")}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Восстановить сессию
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Уже зарегистрированы, но закрыли вкладку или сменили устройство?
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Recover screen ── */}
        {screen === "recover" && (
          <Card className="border-primary/20 shadow-xl shadow-primary/5">
            <CardHeader className="pb-4">
              <Button
                variant="ghost"
                size="sm"
                className="self-start -ml-2 mb-1 text-muted-foreground"
                onClick={() => setScreen("register")}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Назад
              </Button>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Восстановить сессию</CardTitle>
                  <CardDescription className="text-sm mt-0.5">Введите имя, команду и PIN-код, которые указали при регистрации</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={onRecover} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Имя / Позывной *
                  </Label>
                  <Input
                    required
                    value={recoverName}
                    onChange={e => setRecoverName(e.target.value)}
                    placeholder="Агент 007"
                    className="h-12 text-base px-4 bg-muted/50"
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Команда (если указывали)
                  </Label>
                  <Input
                    value={recoverTeam}
                    onChange={e => setRecoverTeam(e.target.value)}
                    placeholder="Альфа"
                    className="h-12 text-base px-4 bg-muted/50"
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    PIN-код *
                  </Label>
                  <Input
                    required
                    value={recoverPin}
                    onChange={e => setRecoverPin(digitsOnly(e.target.value))}
                    placeholder="0000"
                    inputMode="numeric"
                    autoComplete="off"
                    className="h-12 text-base px-4 bg-muted/50 font-mono tracking-[0.3em]"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold h-12"
                  disabled={recoverPending || !recoverName.trim() || recoverPin.length !== 4}
                >
                  {recoverPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Поиск...</>
                  ) : "Найти мою сессию"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
