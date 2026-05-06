import React from "react";
import { LogOut, ChevronRight, ShieldCheck, GraduationCap, Shield, LayoutDashboard } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { BottomNav, NavKey } from "@/components/booking/BottomNav";
import { UserProfile } from "@/types/booking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  user: UserProfile;
  onLogout: () => void;
  onNavigate: (key: NavKey | string) => void;
  isAdmin?: boolean;
}

export const ProfileScreen = ({ user, isAdmin = false, onLogout, onNavigate }: Props) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="px-5 md:px-8 pt-4 pb-3 text-center">
        <h1 className="text-base font-semibold">Профиль</h1>
      </header>

      <div className="flex-1 px-5 md:px-8 pt-2 pb-4 space-y-4 overflow-y-auto">
        <section className="rounded-2xl border border-border bg-card shadow-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {user.position} · {user.department}
            </p>
            <RoleBadge role={user.role} />
          </div>
        </section>

        <div className="pt-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Оформление
          </h2>
          <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden flex flex-col">
            <div className="w-full flex items-center justify-between px-4 py-3.5 bg-card relative">
              <div>
                <p className="text-sm font-medium">Тема приложения</p>
                <p className="text-xs text-muted-foreground mt-0.5">Светлая или тёмная тема</p>
              </div>

              <div className="w-[170px]">
                <Select value={theme ?? "system"} onValueChange={setTheme}>
                  <SelectTrigger className="h-10 rounded-lg border-border bg-background">
                    <SelectValue placeholder="Тема" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Светлая</SelectItem>
                    <SelectItem value="dark">Тёмная</SelectItem>
                    <SelectItem value="system">Системная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        {(isAdmin || user.role === "admin") && (
          <Button
            onClick={() => onNavigate("admin_dashboard")}
            className="w-full h-12 rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-violet-500/20"
          >
            <LayoutDashboard className="w-4 h-4" />
            Admin Panel
          </Button>
        )}

        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive-soft hover:text-destructive gap-2"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </Button>

        <p className="text-center text-xs text-muted-foreground">Версия 1.0.0</p>
      </div>

      <BottomNav active="profile" isAdmin={isAdmin} onNavigate={onNavigate} />
    </div>
  );
};

const roleConfig = {
  student: { label: "Ученик", icon: GraduationCap, color: "bg-blue-500/10 text-blue-500" },
  teacher: { label: "Преподаватель", icon: ShieldCheck, color: "bg-primary/10 text-primary" },
  admin: { label: "Администратор", icon: Shield, color: "bg-purple-500/10 text-purple-500" },
};

const RoleBadge = ({ role }: { role?: string }) => {
  const cfg = roleConfig[role as keyof typeof roleConfig] ?? roleConfig.student;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

