import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Video } from "lucide-react";
import { listCameras, createCamera, type Camera } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/cameras")({ component: CamerasPage });

function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  async function add() {
    const name = prompt("Название камеры", "Камера");
    if (!name) return;
    setAdding(true);
    try {
      await createCamera(name);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои камеры</h1>
        <Button onClick={add} disabled={adding}>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.path}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
