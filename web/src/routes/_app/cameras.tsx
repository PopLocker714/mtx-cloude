import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Video, Link2 } from "lucide-react";
import { listCameras, type Camera } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectCameraDialog } from "@/components/connect-camera-dialog";

export const Route = createFileRoute("/_app/cameras")({ component: CamerasPage });

function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [connId, setConnId] = useState<string | null>(null);

  async function refresh() {
    try {
      setCameras(await listCameras());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои камеры</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Добавить камеру
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {cameras === null ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : cameras.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="size-8 mx-auto mb-2 opacity-50" />
            Пока нет камер. Нажмите «Добавить камеру», чтобы получить данные для подключения.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Путь (id потока)</TableHead>
                  <TableHead>Добавлена</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.path}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setConnId(c.id)}>
                        <Link2 className="size-4" /> Подключение
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Мастер добавления новой камеры */}
      <ConnectCameraDialog open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />

      {/* Данные подключения существующей камеры */}
      <ConnectCameraDialog open={connId !== null} onOpenChange={(v) => !v && setConnId(null)} existingId={connId ?? undefined} />
    </div>
  );
}
