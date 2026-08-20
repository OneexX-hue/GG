import { useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight, Volume2, VolumeX } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const logoWhite = { filter: "brightness(0) invert(1)" } as const;

export default function Landing() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted) video.play().catch(() => {});
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-white selection:bg-white selection:text-black">
      {/* ── Фоновое видео ── */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45"
      >
        <source src={`${BASE}/media/burnout.mp4`} type="video/mp4" />
      </video>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />

      <button
        onClick={toggleSound}
        className="absolute bottom-6 right-6 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm transition-all hover:border-white hover:bg-black/60"
        aria-label={muted ? "Включить звук" : "Выключить звук"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* ── Контент ── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-20">
        <img
          src={`${BASE}/logo.svg`}
          alt="Surgut Smotra"
          className="mb-10 w-[85vw] max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl"
          style={logoWhite}
        />

        <h1 className="font-heading max-w-3xl text-center text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
          Ночь — это наш день!
        </h1>

        <div className="mt-10">
          <Link href="/quest">
            <Button
              size="lg"
              className="group h-13 rounded-md bg-white px-10 text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_0_rgba(255,255,255,0)] transition-all hover:bg-white hover:shadow-[0_0_35px_rgba(255,255,255,0.35)]"
            >
              Квест
              <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
