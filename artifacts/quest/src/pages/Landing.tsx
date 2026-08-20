import type { ComponentType } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send, Instagram, ChevronRight, ChevronDown, Compass, Camera, Moon, Users2,
  MapPin, Trophy, Sparkles, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const SOCIALS = [
  { label: "Telegram", href: "#", icon: Send },
  { label: "Instagram", href: "#", icon: Instagram },
];

const TEAM = [
  { name: "Артём", role: "Главный организатор", blurb: "Придумывает маршруты и следит, чтобы всё шло по графику." },
  { name: "Мария", role: "Куратор квестов", blurb: "Модерирует фото-задания и помогает командам в чате поддержки." },
  { name: "Игорь", role: "Техническая часть", blurb: "Отвечает за площадку, звук и техническое сопровождение мероприятий." },
  { name: "Дарья", role: "Работа с партнёрами", blurb: "Договаривается со спонсорами и площадками для будущих ивентов." },
];

const QUEST_TYPES = [
  { title: "Городской квест-детектив", desc: "Команды ищут подсказки по городу и разгадывают общую загадку.", icon: Compass },
  { title: "Фото-квест по местам культа", desc: "Точки на карте, творческое фото на каждой — админ проверяет прямо в игре.", icon: Camera },
  { title: "Ночной квест-охота", desc: "Атмосферный вечерний формат с фонариками и более сложными задачами.", icon: Moon },
  { title: "Корпоративный тимбилдинг", desc: "Формат под закрытые мероприятия и компании — под ваш сценарий.", icon: Users2 },
];

const SPONSOR_SLOTS = Array.from({ length: 6 });

const logoWhite = { filter: "brightness(0) invert(1)" } as const;

function SectionHeading({
  icon: Icon, eyebrow, title,
}: { icon: ComponentType<{ className?: string }>; eyebrow: string; title: string }) {
  return (
    <div className="mb-12 flex flex-col items-center text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
        <Icon className="h-5 w-5 text-white/70" />
      </div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">{eyebrow}</p>
      <h2 className="font-heading text-4xl uppercase tracking-wide sm:text-5xl">{title}</h2>
      <div className="mt-4 h-px w-12 bg-white/20" />
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* ── Hero ── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-20">
        {/* TODO: замените этот блок на фоновое видео (стрит-рейсинг/BMW), когда будет файл:
            <video autoPlay loop muted={false} playsInline className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50">
              <source src={`${BASE}/hero-bg.mp4`} type="video/mp4" />
            </video>
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/40 to-black/70" />
        */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-neutral-900 via-black to-black">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:64px_64px]" />
        </div>

        <img src={`${BASE}/logo.svg`} alt="Surgut Smotra" className="mb-10 w-52 sm:w-64" style={logoWhite} />

        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
          Сургут · Квесты · Авто-культура
        </p>
        <h1 className="font-heading max-w-3xl text-center text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
          Тимбилдинг в духе <span className="text-white/50">street</span> culture
        </h1>
        <p className="mt-6 max-w-xl text-center text-base text-neutral-400 sm:text-lg">
          Городские квесты, фото-задания и командные испытания — от Surgut Smotra.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/quest">
            <Button
              size="lg"
              className="group h-13 rounded-md bg-white px-8 text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_0_rgba(255,255,255,0)] transition-all hover:bg-white hover:shadow-[0_0_35px_rgba(255,255,255,0.35)]"
            >
              Пройти квест
              <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <a href="#gallery">
            <Button
              size="lg"
              variant="outline"
              className="h-13 rounded-md border-white/25 bg-transparent px-8 text-sm font-bold uppercase tracking-widest text-white hover:border-white hover:bg-white/10 hover:text-white"
            >
              Галерея
            </Button>
          </a>
        </div>

        <div className="mt-12 flex items-center gap-4">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              aria-label={s.label}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/70 transition-all hover:-translate-y-0.5 hover:border-white hover:text-white"
            >
              <s.icon className="h-5 w-5" />
            </a>
          ))}
          <a
            href="#"
            aria-label="VK"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-sm font-bold text-white/70 transition-all hover:-translate-y-0.5 hover:border-white hover:text-white"
          >
            VK
          </a>
        </div>

        <ChevronDown className="absolute bottom-8 h-5 w-5 animate-bounce text-white/30" />
      </section>

      {/* ── Девиз ── */}
      <section className="border-t border-white/10 px-4 py-16">
        <p className="mx-auto max-w-2xl text-center font-heading text-2xl uppercase leading-snug tracking-wide text-white/80 sm:text-3xl">
          «Не важно, какая у тебя машина —<br className="hidden sm:block" /> главное, чтобы человек был хороший»
        </p>
      </section>

      {/* ── Команда ── */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <SectionHeading icon={Users2} eyebrow="Кто за этим стоит" title="Организаторы" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <Card
              key={m.name}
              className="group border-white/10 bg-white/[0.03] text-white transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]"
            >
              <CardContent className="pt-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 font-heading text-2xl transition-colors group-hover:border-white/40">
                  {m.name[0]}
                </div>
                <p className="font-semibold">{m.name}</p>
                <p className="mb-3 text-xs uppercase tracking-wide text-white/50">{m.role}</p>
                <p className="text-sm text-white/45">{m.blurb}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Виды квестов ── */}
      <section className="border-t border-white/10 bg-white/[0.02] px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <SectionHeading icon={Trophy} eyebrow="Форматы" title="Виды квестов" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUEST_TYPES.map((q) => (
              <Card
                key={q.title}
                className="group border-white/10 bg-white/[0.03] text-white transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]"
              >
                <CardContent className="flex gap-4 pt-8">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 transition-colors group-hover:border-white/40">
                    <q.icon className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="mb-1 font-semibold">{q.title}</p>
                    <p className="text-sm text-white/50">{q.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Галерея ── */}
      <section id="gallery" className="mx-auto max-w-5xl px-4 py-24 scroll-mt-8">
        <SectionHeading icon={Sparkles} eyebrow="Атмосфера" title="Галерея" />
        {/* TODO: заменить на реальные фото с мероприятий */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition-colors hover:border-white/25 hover:bg-white/[0.06]"
            >
              <ImageIcon className="h-6 w-6 text-white/15" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Спонсоры ── */}
      <section className="border-t border-white/10 bg-white/[0.02] px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <SectionHeading icon={MapPin} eyebrow="Партнёры" title="Карта спонсоров" />
          {/* TODO: заменить на реальные логотипы и ссылки спонсоров */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SPONSOR_SLOTS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/15",
                  "text-xs uppercase tracking-wide text-white/25 transition-colors hover:border-white/35 hover:text-white/40"
                )}
              >
                Спонсор
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Футер ── */}
      <footer className="border-t border-white/10 px-4 py-12 text-center text-sm text-white/40">
        <img src={`${BASE}/logo.svg`} alt="Surgut Smotra" className="mx-auto mb-5 w-28 opacity-60" style={logoWhite} />
        <div className="mb-5 flex items-center justify-center gap-5">
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} aria-label={s.label} className="transition-colors hover:text-white">
              <s.icon className="h-4 w-4" />
            </a>
          ))}
          <a href="#" aria-label="VK" className="text-xs font-bold transition-colors hover:text-white">VK</a>
        </div>
        <p className="text-xs uppercase tracking-[0.2em]">© {new Date().getFullYear()} Surgut Smotra</p>
      </footer>
    </div>
  );
}
