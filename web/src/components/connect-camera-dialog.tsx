import { useEffect, useState } from "react";
import { Check, Copy, Server, Terminal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createCamera, getConnection, listBridges, type CameraConnection, type Bridge } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" size="icon" onClick={copy} title="Копировать">
          {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingId?: string;
  onCreated?: () => void;
};

export function ConnectCameraDialog({ open, onOpenChange, existingId, onCreated }: Props) {
  const [mode, setMode] = useState<"bridge" | "manual">("bridge");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [bridgeId, setBridgeId] = useState("");
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [conn, setConn] = useState<CameraConnection | null>(null); // ручной flow — данные подключения
  const [addedViaBridge, setAddedViaBridge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("bridge");
      setName("");
      setSourceUrl("");
      setBridgeId("");
      setConn(null);
      setAddedViaBridge(false);
      setError(null);
      return;
    }
    if (existingId) {
      setBusy(true);
      getConnection(existingId)
        .then(setConn)
        .catch((e) => setError((e as Error).message))
        .finally(() => setBusy(false));
    } else {
      listBridges()
        .then((bs) => {
          const paired = bs.filter((b) => b.paired);
          setBridges(paired);
          if (paired[0]) setBridgeId(paired[0].id);
        })
        .catch(() => {});
    }
  }, [open, existingId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "bridge") {
        await createCamera({ name: name || "Камера", bridgeId, sourceUrl });
        setAddedViaBridge(true);
        onCreated?.();
      } else {
        const c = await createCamera({ name: name || "Камера" });
        setConn(c);
        onCreated?.();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ffmpeg = conn
    ? `ffmpeg -rtsp_transport tcp -i "rtsp://ЛОГИН:ПАРОЛЬ@IP_КАМЕРЫ:554/поток" \\\n  -c copy -f rtsp -rtsp_transport tcp "${conn.ingestUrl}"`
    : "";

  // Экран после добавления через bridge
  if (addedViaBridge) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Камера добавлена</DialogTitle>
            <DialogDescription>
              Bridge подключит её автоматически в течение ~30 секунд. Как поток пойдёт — камера станет «онлайн»,
              появятся live и запись.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Экран данных подключения (ручной flow / существующая камера)
  if (conn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Подключение: {conn.name}</DialogTitle>
            <DialogDescription>
              Подключите камеру вручную командой ffmpeg на любом устройстве в её локальной сети.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <CopyField label="Ссылка для публикации (ingest)" value={conn.ingestUrl} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Команда ffmpeg (замените -i на RTSP вашей камеры)</Label>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{ffmpeg}</pre>
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(ffmpeg)}>
                <Copy className="size-4" /> Копировать команду
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Добавить камеру</DialogTitle>
          <DialogDescription>Через bridge — камера подключится сама. Вручную — команда ffmpeg.</DialogDescription>
        </DialogHeader>

        {/* Выбор режима */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("bridge")}
            className={cn(
              "flex items-center gap-2 rounded-md border p-3 text-sm text-left transition",
              mode === "bridge" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"
            )}
          >
            <Server className="size-4" /> Через bridge
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "flex items-center gap-2 rounded-md border p-3 text-sm text-left transition",
              mode === "manual" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"
            )}
          >
            <Terminal className="size-4" /> Вручную (ffmpeg)
          </button>
        </div>

        <form onSubmit={create} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cam-name">Название</Label>
            <Input id="cam-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Двор, Вход, Склад…" />
          </div>

          {mode === "bridge" &&
            (bridges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Нет привязанного bridge.{" "}
                <Link to="/bridges" className="underline" onClick={() => onOpenChange(false)}>
                  Добавьте bridge
                </Link>{" "}
                — маленькую программу в сети камеры, она подключит камеры автоматически.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bridge">Bridge</Label>
                  <select
                    id="bridge"
                    value={bridgeId}
                    onChange={(e) => setBridgeId(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {bridges.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.online ? "(онлайн)" : "(офлайн)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="src">RTSP-ссылка камеры</Label>
                  <Input
                    id="src"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="rtsp://логин:пароль@192.168.1.50:554/stream1"
                    className="font-mono text-xs"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Логин/пароль камеры шифруются. Bridge заберёт поток из локальной сети и отправит в облако.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Совет: закрепите IP камеры на роутере (DHCP-резервация) — иначе при смене адреса ссылка
                    перестанет работать. Как — в разделе «Как подключить камеру».
                  </p>
                </div>
              </>
            ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || (mode === "bridge" && bridges.length === 0)}>
              {busy ? "…" : mode === "bridge" ? "Добавить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
