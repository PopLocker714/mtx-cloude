import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createCamera, getConnection, type CameraConnection } from "@/lib/api";
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

// Поле «только чтение» с кнопкой копирования.
function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
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
        <Input readOnly value={value} className={mono ? "font-mono text-xs" : "text-sm"} onFocus={(e) => e.target.select()} />
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
  existingId?: string; // если задан — показываем данные существующей камеры
  onCreated?: () => void; // колбэк после создания (обновить список)
};

export function ConnectCameraDialog({ open, onOpenChange, existingId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [conn, setConn] = useState<CameraConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Сброс при открытии/закрытии; для существующей камеры — подгрузить данные.
  useEffect(() => {
    if (!open) {
      setName("");
      setConn(null);
      setError(null);
      return;
    }
    if (existingId) {
      setBusy(true);
      getConnection(existingId)
        .then(setConn)
        .catch((e) => setError((e as Error).message))
        .finally(() => setBusy(false));
    }
  }, [open, existingId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await createCamera(name || "Камера");
      setConn(c);
      onCreated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ffmpeg = conn
    ? `ffmpeg -rtsp_transport tcp -i "rtsp://ЛОГИН:ПАРОЛЬ@IP_КАМЕРЫ:554/поток" \\\n  -c copy -f rtsp -rtsp_transport tcp "${conn.ingestUrl}"`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {!conn ? (
          <>
            <DialogHeader>
              <DialogTitle>Добавить камеру</DialogTitle>
              <DialogDescription>Назовите камеру — дальше покажем данные для подключения.</DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cam-name">Название</Label>
                <Input id="cam-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Двор, Вход, Склад…" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={busy}>{busy ? "…" : "Создать"}</Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Подключение: {conn.name}</DialogTitle>
              <DialogDescription>
                Пока bridge не готов — подключите камеру вручную командой ffmpeg на любом устройстве в её локальной сети.
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
              <p className="text-xs text-muted-foreground">
                Запустите команду на компьютере/мини-ПК в сети камеры. Как поток пойдёт — камера станет «онлайн»,
                запись и просмотр появятся в кабинете. Токен публикации — секрет, не публикуйте его.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Готово</Button>
            </DialogFooter>
          </>
        )}
        {busy && existingId && !conn && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      </DialogContent>
    </Dialog>
  );
}
