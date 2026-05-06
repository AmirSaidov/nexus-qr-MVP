import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Users, Clock, XCircle, CheckCircle, RefreshCw } from "lucide-react";
import { fetchDashboard, DashboardStats } from "@/lib/admin";

interface Props {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

export const AdminDashboardScreen = ({ onBack, onNavigate }: Props) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchDashboard()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const cards = stats
    ? [
        { label: "Активных кабинетов", value: stats.active_rooms, icon: Building2 },
        { label: "Учеников в системе", value: stats.students_in_system, icon: Users },
        { label: "Ожидают (pending)", value: stats.pending, icon: Clock },
        { label: "Подтверждённых", value: stats.confirmed, icon: CheckCircle },
        { label: "Отклонённых сегодня", value: stats.rejected_today, icon: XCircle },
      ]
    : [];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">Панель управления системой</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading && !stats ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {cards.map((c, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-2xl p-4 bg-card border border-border text-foreground ${i === 0 ? "col-span-2" : ""}`}
                >
                  <c.icon className="absolute top-3 right-3 w-8 h-8 text-muted-foreground opacity-30" />
                  <p className="text-3xl font-bold">{c.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <p className="text-xs text-muted-foreground uppercase tracking-wider pt-4 pb-1 font-semibold">
              Разделы
            </p>
            {[
              { key: "admin_rooms", label: "Кабинеты", desc: "Управление и создание кабинетов", icon: Building2 },
              { key: "admin_logs", label: "Логи системы", desc: "История действий и фильтры", icon: Clock },
              { key: "admin_rejected", label: "Отклонённые", desc: "Список отклонённых учеников", icon: XCircle },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-muted/50 transition-all active:scale-[0.98] text-left"
              >
                <div className="p-2.5 rounded-xl bg-muted text-foreground">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
