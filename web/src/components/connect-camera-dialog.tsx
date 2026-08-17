import { useEffect, useState } from "react";
import { Check, Copy, Server, Terminal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createCamera, getConnection, listBridges, type CameraConnection, type Bridge } from "@/lib/api";
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

/** RTSP-URL из полей формы: креды энкодятся, путь чистится от ведущего /. */
function buildRtspUrl(f: { host: string; port: string; user: string; pass: string; path: string }): string {
  const creds = f.user ? `${encodeURIComponent(f.user)}:${encodeURIComponent(f.pass)}@` : "";
  const path = f.path.trim().replace(/^\/+/, "");
  return `rtsp://${creds}${f.host.trim()}:${f.port.trim() || "554"}${path ? `/${path}` : ""}`;
}

export function ConnectCameraDialog({ open, onOpenChange, existingId, onCreated }: Props) {
  const [mode, setMode] = useState<"bridge" | "manual">("bridge");
  // Камеру описываем полями, RTSP-ссылку собираем сами (никто не должен
  // вписывать пароль в строку руками). Целая ссылка — продвинутый вариант
  // для нестандартных камер.
  const [useRawUrl, setUseRawUrl] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("554");
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("");
  const [path, setPath] = useState("");
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
      setUseRawUrl(false);
      setHost("");
      setPort("554");
      setUser("admin");
      setPass("");
      setPath("");
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
        const url = useRawUrl ? sourceUrl : buildRtspUrl({ host, port, user, pass, path });
        await createCamera({ name: name || "Камера", bridgeId, sourceUrl: url });
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
          <DialogDescription>
            {mode === "bridge"
              ? "Bridge заберёт поток из локальной сети и отправит в облако. Логин и пароль камеры шифруются."
              : "Продвинутый режим: поток отправляется вручную командой ffmpeg."}
          </DialogDescription>
        </DialogHeader>

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
                {bridges.length > 1 && (
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
                )}

                {useRawUrl ? (
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
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_6rem] gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="cam-host">IP-адрес камеры</Label>
                        <Input
                          id="cam-host"
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          placeholder="192.168.1.50"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cam-port">Порт</Label>
                        <Input id="cam-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="554" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="cam-user">Логин камеры</Label>
                        <Input id="cam-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cam-pass">Пароль камеры</Label>
                        <Input
                          id="cam-pass"
                          type="password"
                          value={pass}
                          onChange={(e) => setPass(e.target.value)}
                          placeholder="у многих камер пустой"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cam-path">
                        Путь потока <span className="text-muted-foreground">(необязательно)</span>
                      </Label>
                      <Input
                        id="cam-path"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="stream1, ch01, live/ch00_0…"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Не знаете путь и порт — найдите свою камеру в{" "}
                        <a href="/uk/guides" target="_blank" rel="noreferrer" className="underline">
                          инструкциях по брендам
                        </a>
                        .
                      </p>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setUseRawUrl(!useRawUrl)}
                >
                  {useRawUrl ? "Ввести адрес и пароль по полям" : "У меня готовая RTSP-ссылка"}
                </button>

                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Совет: закрепите IP камеры на роутере (DHCP-резервация), иначе при смене адреса подключение
                  оборвётся.
                </p>
              </>
            ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="items-center gap-3 sm:justify-between">
            {/* ffmpeg — намеренно незаметная ссылка: это путь для продвинутых. */}
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "bridge" ? "manual" : "bridge")}
            >
              {mode === "bridge" ? (
                <span className="inline-flex items-center gap-1">
                  <Terminal className="size-3" /> Продвинутый режим: свой ffmpeg
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Server className="size-3" /> Обычный режим: через bridge
                </span>
              )}
            </button>
            <Button type="submit" disabled={busy || (mode === "bridge" && bridges.length === 0)}>
              {busy ? "…" : mode === "bridge" ? "Добавить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
