import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, Radio, Film, Loader2, WifiOff, Zap } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import {
  getConnection,
  createViewToken,
  listArchive,
  fetchArchiveClip,
  listEvents,
  type ArchiveSegment,
  type MotionEvent,
} from "@/lib/api";
import { LIVE_BASE } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// --- Минимальный WHEP-клиент (WebRTC live через MediaMTX) ---
async function startWhep(video: HTMLVideoElement, path: string, token: string): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });
  pc.ontrack = (e) => {
    video.srcObject = e.streams[0];
    video.play().catch(() => {});
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // non-trickle: ждём сбор всех ICE-кандидатов, потом шлём полный offer
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(resolve, 2000); // подстраховка
  });
  const res = await fetch(`${LIVE_BASE}/${path}/whep`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp", Authorization: "Basic " + btoa("view:" + token) },
    body: pc.localDescription!.sdp,
  });
  if (!res.ok) throw new Error("WHEP " + res.status);
  const answer = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  return pc;
}

function fmt(d: Date) {
  return d.toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function CameraView({ cameraId }: { cameraId: string }) {
  const [locale] = useAppLocale();
  const [path, setPath] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const conn = await getConnection(cameraId);
        if (!alive) return;
        setPath(conn.path);
        setName(conn.name);
        const vt = await createViewToken(cameraId);
        if (!alive) return;
        setToken(vt.token);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cameraId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!path || !token) return <p className="text-muted-foreground">{m.app_loading({}, { locale })}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <LiveCard path={path} token={token} />
        <ArchiveCard cameraId={cameraId} path={path} token={token} />
      </div>
    </div>
  );
}

function LiveCard({ path, token }: { path: string; token: string }) {
  const [locale] = useAppLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live" | "error">("idle");

  async function connect() {
    setState("connecting");
    try {
      pcRef.current?.close();
      const pc = await startWhep(videoRef.current!, path, token);
      pcRef.current = pc;
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setState("live");
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setState("error");
      };
    } catch {
      setState("error");
    }
  }

  useEffect(() => () => pcRef.current?.close(), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="size-4" /> {m.cv_live({}, { locale })}
          {state === "live" && <span className="text-xs text-signal font-medium">{m.cv_on_air({}, { locale })}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            controls={state === "live"}
          />
          {/* Плеер грузится по клику: пока не «в эфире» — кликабельная накладка */}
          {state !== "live" && (
            <button
              type="button"
              onClick={connect}
              disabled={state === "connecting"}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white transition hover:bg-black/40 disabled:cursor-wait"
            >
              {state === "connecting" ? (
                <>
                  <Loader2 className="size-9 animate-spin" />
                  <span className="text-sm">{m.cv_connecting({}, { locale })}</span>
                </>
              ) : state === "error" ? (
                <>
                  <WifiOff className="size-9" />
                  <span className="text-sm">{m.cv_offline({}, { locale })}</span>
                  <span className="text-xs underline">{m.cv_retry({}, { locale })}</span>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-white/15 p-4 ring-1 ring-white/25">
                    <Play className="size-8 fill-white" />
                  </span>
                  <span className="text-sm font-medium">{m.cv_watch({}, { locale })}</span>
                </>
              )}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function eventDuration(ev: MotionEvent): number {
  const end = ev.endedAt ? new Date(ev.endedAt).getTime() : Date.now();
  const sec = (end - new Date(ev.startedAt).getTime()) / 1000;
  return Math.min(Math.max(Math.ceil(sec) + 3, 8), 600); // +3с хвоста, в пределах 8с…10мин
}

function ArchiveCard({ cameraId, path, token }: { cameraId: string; path: string; token: string }) {
  const [locale] = useAppLocale();
  const [segments, setSegments] = useState<ArchiveSegment[] | null>(null);
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // ключ выбранного клипа
  const [clipUrl, setClipUrl] = useState<string | null>(null); // blob-URL текущего клипа
  const [loadingClip, setLoadingClip] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [segs, evs] = await Promise.all([listArchive(path, token), listEvents(cameraId).catch(() => [])]);
      setSegments(segs);
      setEvents(evs);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, path, token]);

  // Общий плеер: и записи, и события открывают клип по времени.
  async function playClip(startISO: string, durationSec: number, key: string) {
    setLoadingClip(key);
    setError(null);
    try {
      const url = await fetchArchiveClip(path, startISO, durationSec, token);
      setSelected(key);
      setClipUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingClip(null);
    }
  }
  const play = (s: ArchiveSegment) => playClip(s.start, Math.min(Math.ceil(s.duration), 600), s.start);
  const playEvent = (ev: MotionEvent) => playClip(ev.startedAt, eventDuration(ev), "ev:" + ev.id);

  const span = segments && segments.length ? timelineSpan(segments) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="size-4" /> {m.cv_archive({}, { locale })}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={refresh} title={m.cv_refresh({}, { locale })}>
          <RefreshCw className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Плеер архива: video монтируется только когда выбрана запись (по клику); иначе — подсказка */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
          {clipUrl ? (
            <video key={clipUrl} src={clipUrl} className="w-full h-full object-contain" autoPlay muted playsInline controls />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
              <Film className="size-8 opacity-40" />
              <span className="text-sm">{m.cv_pick({}, { locale })}</span>
            </div>
          )}
          {loadingClip && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="size-8 animate-spin" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* События движения — приоритетная навигация: сразу к «что произошло» */}
        {events.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Zap className="size-4 text-primary" /> {m.cv_events({}, { locale })}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
              {events.map((ev) => {
                const key = "ev:" + ev.id;
                const active = selected === key;
                return (
                  <button
                    key={ev.id}
                    onClick={() => playEvent(ev)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-sm text-left transition hover:bg-muted cursor-pointer",
                      active && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                      )}
                    >
                      {loadingClip === key ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                    </span>
                    <span className="flex-1 font-medium">{fmt(new Date(ev.startedAt))}</span>
                    <span className="text-xs text-muted-foreground">
                      {ev.endedAt ? m.cv_motion({}, { locale }) : m.cv_ongoing({}, { locale })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {segments === null ? (
          <p className="text-xs text-muted-foreground">{m.cv_arch_loading({}, { locale })}</p>
        ) : segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{m.cv_no_records({}, { locale })}</p>
        ) : (
          <>
            {/* Полоса-таймлайн: кликабельные блоки записей */}
            {span && (
              <div className="relative h-7 rounded bg-muted overflow-hidden" title={m.cv_period({}, { locale })}>
                {segments.map((s) => {
                  const start = new Date(s.start).getTime();
                  const left = ((start - span.from) / span.width) * 100;
                  const w = Math.max((s.duration * 1000) / span.width * 100, 0.6);
                  return (
                    <button
                      key={s.start}
                      onClick={() => play(s)}
                      title={`${fmt(new Date(s.start))} · ${Math.round(s.duration)} ${m.cv_sec({}, { locale })} — ${m.cv_click_to_view({}, { locale })}`}
                      className={cn(
                        "absolute top-0 h-full transition hover:brightness-110",
                        selected === s.start ? "bg-primary ring-2 ring-primary ring-inset" : "bg-primary/60 hover:bg-primary/80"
                      )}
                      style={{ left: `${left}%`, width: `${w}%` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Все записи — явно кликабельный список */}
            <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
              {segments.map((s) => {
                const active = selected === s.start;
                return (
                  <button
                    key={s.start}
                    onClick={() => play(s)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-sm text-left transition hover:bg-muted cursor-pointer",
                      active && "bg-primary/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                      )}
                    >
                      {loadingClip === s.start ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                    </span>
                    <span className="flex-1 font-medium">{fmt(new Date(s.start))}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(s.duration)} {m.cv_sec({}, { locale })}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function timelineSpan(segs: ArchiveSegment[]) {
  const from = new Date(segs[0].start).getTime();
  const last = segs[segs.length - 1];
  const to = new Date(last.start).getTime() + last.duration * 1000;
  return { from, width: Math.max(to - from, 1) };
}
