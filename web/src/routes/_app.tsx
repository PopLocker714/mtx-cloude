import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Video, LogOut, Shield, User, Server } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { applySeedToElement, clearSeedFromElement, loadSeed } from "@/lib/m3-theme";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
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

// Динамический цвет (M3): выбранный в профиле seed применяется ко всему
// поддереву ЛК через CSS-переменные на display:contents-обёртке.
// Кастомные свойства наследуются, боксов обёртка не создаёт.
// Маркетинговые страницы остаются на бренд-палитре.
function AppThemeScope({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const seed = loadSeed();
      if (seed) applySeedToElement(el, seed, resolvedTheme === "dark");
      else clearSeedFromElement(el);
    };
    apply();
    window.addEventListener("oko-seed-change", apply);
    return () => window.removeEventListener("oko-seed-change", apply);
  }, [resolvedTheme]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

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
    <AppThemeScope>
    <SidebarProvider>
      {/* M3 drawer: без бордера (разница поверхностей вместо линии). */}
      <Sidebar className="border-none">
        <SidebarHeader className="px-4 pt-4">
          {/* Бренд как на лендинге: анимированный глаз-облако + wordmark. */}
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Logo className="h-6" />
            <span className="font-display text-lg font-bold tracking-tight">oko</span>
            <span className="ml-1 text-xs text-muted-foreground">cloud</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <SidebarMenu className="gap-1.5">
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
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
    </AppThemeScope>
  );
}
