import { useEffect, useRef, useState } from "react";
import { Play, RefreshCw, Radio, Film } from "lucide-react";
import { getConnection, createViewToken, listArchive, fetchArchiveClip, type ArchiveSegment } from "@/lib/api";
import { LIVE_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  // подгрузка path + view-токена
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
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="size-4" /> Прямой эфир
          {state === "live" && <span className="text-xs text-red-600 font-normal">● LIVE</span>}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={connect} disabled={state === "connecting"}>
          {state === "connecting" ? "…" : <><Play className="size-4" /> Смотреть</>}
        </Button>
      </CardHeader>
      <CardContent>
        <video ref={videoRef} className="w-full aspect-video rounded bg-black" playsInline muted controls />
        {state === "idle" && <p className="text-xs text-muted-foreground mt-2">Нажмите «Смотреть», чтобы подключиться к камере.</p>}
        {state === "error" && <p className="text-xs text-destructive mt-2">Камера офлайн или поток недоступен.</p>}
      </CardContent>
    </Card>
  );
}

function ArchiveCard({ path, token }: { path: string; token: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [segments, setSegments] = useState<ArchiveSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const dur = Math.min(Math.ceil(seg.duration), 600); // максимум 10 минут за раз
      const url = await fetchArchiveClip(path, seg.start, dur, token);
      const v = videoRef.current!;
      v.src = url;
      await v.play().catch(() => {});
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
        <Button size="sm" variant="ghost" onClick={refresh}>
          <RefreshCw className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <video ref={videoRef} className="w-full aspect-video rounded bg-black" playsInline controls muted />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {segments === null ? (
          <p className="text-xs text-muted-foreground">Загрузка архива…</p>
        ) : segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Записей пока нет. Как камера начнёт вещать — здесь появится архив.</p>
        ) : (
          <>
            {/* Полоса-таймлайн: блоки записей на общем диапазоне */}
            {span && (
              <div className="relative h-6 rounded bg-muted overflow-hidden">
                {segments.map((s) => {
                  const start = new Date(s.start).getTime();
                  const left = ((start - span.from) / span.width) * 100;
                  const w = Math.max((s.duration * 1000) / span.width * 100, 0.5);
                  return (
                    <button
                      key={s.start}
                      onClick={() => play(s)}
                      title={`${fmt(new Date(s.start))} · ${Math.round(s.duration)}с`}
                      className="absolute top-0 h-full bg-primary/70 hover:bg-primary"
                      style={{ left: `${left}%`, width: `${w}%` }}
                    />
                  );
                })}
              </div>
            )}
            {/* Список записей */}
            <div className="max-h-40 overflow-y-auto space-y-1">
              {segments.map((s) => (
                <button
                  key={s.start}
                  onClick={() => play(s)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted text-left"
                >
                  <span>{fmt(new Date(s.start))}</span>
                  <span className="text-xs text-muted-foreground">
                    {loadingClip === s.start ? "загрузка…" : `${Math.round(s.duration)} с`}
                  </span>
                </button>
              ))}
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
