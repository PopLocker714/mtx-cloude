import { useEffect, useState } from "react";
import { adoptDiscovered, type DiscoveredCamera } from "@/lib/api";
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

type Props = {
  camera: DiscoveredCamera | null;
  onOpenChange: (v: boolean) => void;
  onAdopted?: () => void;
};

// Усыновление найденной ONVIF-камеры: облако уже знает адрес/производителя,
// пользователь вводит только имя и учётные данные камеры (логин/пароль).
export function AdoptCameraDialog({ camera, onOpenChange, onAdopted }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (camera) {
      setName(camera.name || camera.model || "Камера");
      setUsername("admin"); // самый частый ONVIF-логин; пользователь поправит
      setPassword("");
      setError(null);
    }
  }, [camera]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!camera) return;
    setBusy(true);
    setError(null);
    try {
      await adoptDiscovered(camera.id, { name: name.trim() || undefined, username: username.trim(), password });
      onAdopted?.();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const subtitle = camera
    ? [camera.manufacturer, camera.model].filter(Boolean).join(" ") || camera.ip || camera.bridgeName
    : "";

  return (
    <Dialog open={camera !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Подключить камеру</DialogTitle>
          <DialogDescription>
            {subtitle ? `${subtitle} · ` : ""}Введите логин и пароль камеры — адрес потока подберётся автоматически (ONVIF).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ad-name">Название</Label>
            <Input id="ad-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Двор, Вход…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ad-user">Логин камеры</Label>
              <Input id="ad-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-pass">Пароль камеры</Label>
              <Input
                id="ad-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                autoFocus
                placeholder="можно пусто (ONVIF)"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Логин/пароль шифруются и используются только агентом в вашей сети, чтобы получить видеопоток.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Подключаю…" : "Подключить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
