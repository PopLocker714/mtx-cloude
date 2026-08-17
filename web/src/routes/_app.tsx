import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Video, LogOut, Shield, User, Server } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Гард: не залогинен → на /login (клиентский, для v0 достаточно).
  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/login" });
  }, [isPending, session, navigate]);

  if (isPending || !session) return <div className="p-8 text-muted-foreground">Загрузка…</div>;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          {/* Wordmark как на лендинге: oko + красная REC-точка. */}
          <div className="flex items-baseline px-2 py-1">
            <span className="font-display text-lg font-bold tracking-tight">oko</span>
            <span className="ml-0.5 size-1.5 translate-y-[-1px] rounded-full bg-signal" aria-hidden />
            <span className="ml-2 text-xs text-muted-foreground">cloud</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/cameras") || pathname.startsWith("/camera/")}>
                <Link to="/cameras">
                  <Video /> <span>Камеры</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/bridges")}>
                <Link to="/bridges">
                  <Server /> <span>Bridge</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/profile")}>
                <Link to="/profile">
                  <User /> <span>Профиль</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {(session.user as { role?: string }).role === "admin" && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")}>
                  <Link to="/admin">
                    <Shield /> <span>Админка</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 text-xs text-muted-foreground truncate">{session.user.email}</div>
          <Button variant="ghost" size="sm" className="justify-start" onClick={() => signOut().then(() => navigate({ to: "/login" }))}>
            <LogOut className="size-4" /> Выйти
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 h-14">
          <SidebarTrigger />
          <span className="font-display font-semibold">Личный кабинет</span>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
