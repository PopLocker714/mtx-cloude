import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Video, ScrollText } from "lucide-react";
import { adminListCameras, adminAudit, type AdminCamera, type AuditEntry } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

function AdminPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const [cameras, setCameras] = useState<AdminCamera[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    adminListCameras().then(setCameras).catch((e) => setError((e as Error).message));
    adminAudit().then(setAudit).catch((e) => setError((e as Error).message));
  }, [isAdmin]);

  if (session && !isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="size-8 mx-auto mb-2 opacity-50" />
          Доступ только для администраторов.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="size-5" />
        <h1 className="text-2xl font-semibold">Администрирование</h1>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="size-4" /> Все камеры {cameras && <Badge variant="secondary">{cameras.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Владелец</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Путь</TableHead>
                <TableHead>Создана</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cameras?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm">{c.ownerEmail ?? "—"}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.path}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(c.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/camera/$cameraId" params={{ cameraId: c.id }}>
                        <Video className="size-4" /> Смотреть
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cameras && cameras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Камер пока нет.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4" /> Журнал доступа
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Кто</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Камера</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit?.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{a.actorEmail ?? a.actorRole}</TableCell>
                  <TableCell>
                    <Badge variant={a.actorRole === "admin" ? "default" : "outline"}>{a.actorRole}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{a.action}</TableCell>
                  <TableCell className="font-mono text-xs">{a.cameraPath}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
              {audit && audit.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Просмотров пока не было.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
