import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, Plus, Check, Copy, Circle, Trash2, Ban } from "lucide-react";
import { listBridges, createBridge, revokeBridge, deleteBridge, type Bridge } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/bridges")({ component: BridgesPage });

function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

function BridgesPage() {
  const [bridges, setBridges] = useState<Bridge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      setBridges(await listBridges());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    setCreating(true);
    try {
      const b = await createBridge("Bridge");
      setCreated({ code: b.pairingCode });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const dockerCmd = created
    ? `docker run -d --name oko-bridge --restart unless-stopped \\\n  -e OKO_API=${API_BASE} -e OKO_PAIR_CODE=${created.code} \\\n  -v oko-bridge-data:/data oko-bridge:latest`
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Server className="size-5" /> Bridge
        </h1>
        <Button onClick={add} disabled={creating}>
          <Plus className="size-4" /> Добавить bridge
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Bridge — маленькая программа на устройстве в сети ваших камер (мини-ПК, Raspberry Pi). Она забирает поток камер
        по RTSP и отправляет в облако — без проброса портов. Одного bridge хватает на все камеры в этой сети.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {bridges === null ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : bridges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Server className="size-8 mx-auto mb-2 opacity-50" />
            Нет bridge. Нажмите «Добавить bridge», чтобы получить код привязки.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Версия</TableHead>
                  <TableHead>Токен</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridges.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      {!b.paired ? (
                        <Badge variant="outline">код: {b.pairingCode}</Badge>
                      ) : b.online ? (
                        <span className="flex items-center gap-1.5 text-sm text-green-600">
                          <Circle className="size-2 fill-green-600" /> онлайн
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Circle className="size-2 fill-muted-foreground" /> офлайн
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.agentVersion ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{b.tokenPrefix ? b.tokenPrefix + "…" : "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {b.paired && (
                        <Button variant="ghost" size="sm" onClick={() => revokeBridge(b.id).then(refresh)} title="Отозвать токен">
                          <Ban className="size-4" /> Отозвать
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteBridge(b.id).then(refresh)} title="Удалить">
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Диалог с кодом привязки + командой запуска */}
      <Dialog open={created !== null} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bridge создан</DialogTitle>
            <DialogDescription>
              Запустите bridge на устройстве в сети камер. Код действует 15 минут и одноразовый.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Код привязки</Label>
              <div className="text-2xl font-mono font-semibold tracking-widest text-center py-2 bg-muted rounded-md">
                {created?.code}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Команда запуска (Docker)</Label>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{dockerCmd}</pre>
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(dockerCmd)}>
                <Copy className="size-4" /> Копировать команду
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              После привязки токен сохранится на устройстве — код больше не нужен. Дальше добавляйте камеры в кабинете
              с их RTSP-ссылкой, выбирая этот bridge.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
