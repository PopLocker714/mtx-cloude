import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Video, ScrollText, Users } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { adminListCameras, adminAudit, type AdminCamera, type AuditEntry } from "@/lib/api";
import { useSession, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

type AdminUser = { id: string; email: string; name?: string; role?: string; banned?: boolean; createdAt: string | Date };

function AdminPage() {
  const [locale] = useAppLocale();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const myId = session?.user?.id;

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [cameras, setCameras] = useState<AdminCamera[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  async function loadUsers() {
    const res = await authClient.admin.listUsers({ query: { limit: 200 } });
    if (res.error) return setError(res.error.message || m.adm_users_load_failed({}, { locale }));
    setUsers(((res.data as { users?: AdminUser[] })?.users ?? []) as AdminUser[]);
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers().catch((e) => setError((e as Error).message));
    adminListCameras().then(setCameras).catch((e) => setError((e as Error).message));
    adminAudit().then(setAudit).catch((e) => setError((e as Error).message));
  }, [isAdmin]);

  async function toggleRole(u: AdminUser) {
    const next = u.role === "admin" ? "user" : "admin";
    setBusyUser(u.id);
    try {
      const res = await authClient.admin.setRole({ userId: u.id, role: next });
      if (res.error) setError(res.error.message || m.adm_role_failed({}, { locale }));
      else await loadUsers();
    } finally {
      setBusyUser(null);
    }
  }

  async function resetUserPassword(u: AdminUser) {
    const pw = prompt(m.adm_reset_prompt({ email: u.email }, { locale }));
    if (!pw) return;
    if (pw.length < 8) return setError(m.login_password_short({}, { locale }));
    setBusyUser(u.id);
    try {
      const res = await authClient.admin.setUserPassword({ userId: u.id, newPassword: pw });
      if (res.error) setError(res.error.message || m.adm_pw_failed({}, { locale }));
      else setError(null);
    } finally {
      setBusyUser(null);
    }
  }

  if (session && !isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="size-8 mx-auto mb-2 opacity-50" />
          {m.adm_only({}, { locale })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="size-5" />
        <h1 className="text-2xl font-semibold">{m.adm_title({}, { locale })}</h1>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> {m.adm_users({}, { locale })}{" "}
            {users && <Badge variant="secondary">{users.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataList
            rows={users}
            rowKey={(u) => u.id}
            empty={m.adm_no_users({}, { locale })}
            columns={[
              { key: "email", header: m.adm_col_email({}, { locale }), primary: true, className: "text-sm", cell: (u) => u.email },
              { key: "name", header: m.adm_col_name({}, { locale }), className: "text-sm", cell: (u) => u.name ?? "—" },
              {
                key: "role",
                header: m.adm_col_role({}, { locale }),
                cell: (u) => <Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role ?? "user"}</Badge>,
              },
              {
                key: "created",
                header: m.adm_col_created({}, { locale }),
                className: "text-muted-foreground text-sm",
                cell: (u) => new Date(u.createdAt).toLocaleDateString(),
              },
              {
                key: "actions",
                header: m.adm_col_actions({}, { locale }),
                actions: true,
                cell: (u) => (
                  <>
                    <Button variant="ghost" size="sm" disabled={busyUser === u.id} onClick={() => resetUserPassword(u)}>
                      {m.adm_reset_pw({}, { locale })}
                    </Button>
                    {u.id === myId ? (
                      <span className="text-xs text-muted-foreground">{m.adm_you({}, { locale })}</span>
                    ) : (
                      <Button variant="outline" size="sm" disabled={busyUser === u.id} onClick={() => toggleRole(u)}>
                        {u.role === "admin" ? m.adm_remove_admin({}, { locale }) : m.adm_make_admin({}, { locale })}
                      </Button>
                    )}
                  </>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="size-4" /> {m.adm_cameras({}, { locale })}{" "}
            {cameras && <Badge variant="secondary">{cameras.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataList
            rows={cameras}
            rowKey={(c) => c.id}
            empty={m.adm_no_cameras({}, { locale })}
            columns={[
              { key: "name", header: m.adm_col_name({}, { locale }), primary: true, className: "font-medium", cell: (c) => c.name },
              { key: "owner", header: m.adm_col_owner({}, { locale }), className: "text-sm", cell: (c) => c.ownerEmail ?? "—" },
              { key: "path", header: m.adm_col_path({}, { locale }), className: "font-mono text-xs", cell: (c) => <span className="font-mono text-xs">{c.path}</span> },
              {
                key: "created",
                header: m.adm_col_created_at({}, { locale }),
                className: "text-muted-foreground text-sm",
                cell: (c) => new Date(c.createdAt).toLocaleString(),
              },
              {
                key: "actions",
                header: m.adm_col_actions({}, { locale }),
                actions: true,
                cell: (c) => (
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/camera/$cameraId" params={{ cameraId: c.id }}>
                      <Video className="size-4" /> {m.adm_watch({}, { locale })}
                    </Link>
                  </Button>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4" /> {m.adm_audit({}, { locale })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataList
            rows={audit}
            rowKey={(_a, i) => String(i)}
            empty={m.adm_no_audit({}, { locale })}
            columns={[
              { key: "action", header: m.adm_col_action({}, { locale }), primary: true, className: "text-sm", cell: (a) => a.action },
              {
                key: "time",
                header: m.adm_col_time({}, { locale }),
                className: "text-xs text-muted-foreground",
                cell: (a) => new Date(a.at).toLocaleString(),
              },
              { key: "who", header: m.adm_col_who({}, { locale }), className: "text-sm", cell: (a) => a.actorEmail ?? a.actorRole },
              {
                key: "role",
                header: m.adm_col_role({}, { locale }),
                cell: (a) => <Badge variant={a.actorRole === "admin" ? "default" : "outline"}>{a.actorRole}</Badge>,
              },
              { key: "camera", header: m.adm_col_camera({}, { locale }), className: "font-mono text-xs", cell: (a) => <span className="font-mono text-xs">{a.cameraPath}</span> },
              { key: "ip", header: "IP", className: "text-xs text-muted-foreground", cell: (a) => a.ip ?? "—" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
