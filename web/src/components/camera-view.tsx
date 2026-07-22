import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, Radio, Film, Loader2, WifiOff } from "lucide-react";
import { getConnection, createViewToken, listArchive, fetchArchiveClip, type ArchiveSegment } from "@/lib/api";
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
  if (!path || !token) return <p className="text-muted-foreground">Загрузка…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <LiveCard path={path} token={token} />
        <ArchiveCard path={path} token={token} />
      </div>
    </div>
  );
}

function LiveCard({ path, token }: { path: string; token: string }) {
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
          <Radio className="size-4" /> Прямой эфир
          {state === "live" && <span className="text-xs text-red-600 font-medium">● В ЭФИРЕ</span>}
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
                  <span className="text-sm">Подключение…</span>
                </>
              ) : state === "error" ? (
                <>
                  <WifiOff className="size-9" />
                  <span className="text-sm">Камера офлайн или поток недоступен</span>
                  <span className="text-xs underline">Повторить</span>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-white/15 p-4 ring-1 ring-white/25">
                    <Play className="size-8 fill-white" />
                  </span>
                  <span className="text-sm font-medium">Смотреть эфир</span>
                </>
              )}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ArchiveCard({ path, token }: { path: string; token: string }) {
  const [segments, setSegments] = useState<ArchiveSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // start выбранной записи
  const [clipUrl, setClipUrl] = useState<string | null>(null); // blob-URL текущего клипа
  const [loadingClip, setLoadingClip] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      setSegments(await listArchive(path, token));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token]);

  async function play(seg: ArchiveSegment) {
    setLoadingClip(seg.start);
    setError(null);
    try {
      const dur = Math.min(Math.ceil(seg.duration), 600); // максимум 10 минут за раз
      const url = await fetchArchiveClip(path, seg.start, dur, token);
      setSelected(seg.start);
      setClipUrl(url); // video монтируется с этим src и автоплеится (muted)
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingClip(null);
    }
  }

  const span = segments && segments.length ? timelineSpan(segments) : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="size-4" /> Архив (7 дней)
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={refresh} title="Обновить">
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
              <span className="text-sm">Выберите запись ниже для просмотра</span>
            </div>
          )}
          {loadingClip && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="size-8 animate-spin" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {segments === null ? (
          <p className="text-xs text-muted-foreground">Загрузка архива…</p>
        ) : segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Записей пока нет. Как камера начнёт вещать — здесь появится архив.</p>
        ) : (
          <>
            {/* Полоса-таймлайн: кликабельные блоки записей */}
            {span && (
              <div className="relative h-7 rounded bg-muted overflow-hidden" title="Записи за период">
                {segments.map((s) => {
                  const start = new Date(s.start).getTime();
                  const left = ((start - span.from) / span.width) * 100;
                  const w = Math.max((s.duration * 1000) / span.width * 100, 0.6);
                  return (
                    <button
                      key={s.start}
                      onClick={() => play(s)}
                      title={`${fmt(new Date(s.start))} · ${Math.round(s.duration)} с — нажмите для просмотра`}
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

            {/* Список записей — явно кликабельный */}
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
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
                    <span className="text-xs text-muted-foreground">{Math.round(s.duration)} с</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Нажмите на запись, чтобы посмотреть её в плеере выше.</p>
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
