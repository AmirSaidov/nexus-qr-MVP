import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Filter,
  Clock,
  User,
  Building2,
  Hash,
  CheckCircle2,
  XCircle,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLogEntry, fetchAdminRooms, fetchLogs } from "@/lib/admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  onBack: () => void;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const actionMeta = (action: string) => {
  switch (action) {
    case "confirmed":
      return { label: "Подтверждён", Icon: CheckCircle2, className: "text-success" };
    case "rejected":
      return { label: "Отклонён", Icon: XCircle, className: "text-destructive" };
    case "scan":
      return { label: "Скан", Icon: QrCode, className: "text-muted-foreground" };
    default:
      return { label: action || "Событие", Icon: Hash, className: "text-muted-foreground" };
  }
};

export const AdminLogsScreen = ({ onBack }: Props) => {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [roomOptions, setRoomOptions] = useState<{ id: number; name: string }[]>([]);

  const [roomId, setRoomId] = useState("");
  const [action, setAction] = useState("confirmed");
  const [date, setDate] = useState("");

  const roomSelectValue = roomId || "__all_rooms__";
  const actionSelectValue = action || "__all_actions__";

  const params = useMemo(
    () => ({
      room_id: roomId.trim() || undefined,
      action: action.trim() || undefined,
      date: date || undefined,
    }),
    [roomId, action, date]
  );

  const load = () => {
    setLoading(true);
    fetchLogs(params)
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Не удалось загрузить логи"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchAdminRooms()
      .then((rooms) => {
        if (Array.isArray(rooms)) {
          setRoomOptions(
            rooms
              .filter((r) => r && typeof r.id === "number" && typeof r.name === "string")
              .map((r) => ({ id: r.id, name: r.name }))
          );
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.room_id, params.action, params.date]);

  const resetFilters = () => {
    setRoomId("");
    setAction("confirmed");
    setDate("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">Логи системы</h1>
          <p className="text-xs text-muted-foreground">{logs.length} записей</p>
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="p-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          aria-label="Toggle filters"
        >
          <Filter className="w-5 h-5" />
        </button>
        <button
          onClick={load}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      {filtersOpen && (
        <div className="px-4 pb-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Фильтры</div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Сбросить
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <label>
                <span className="block text-xs text-muted-foreground mb-1">Кабинет</span>
                <Select
                  value={roomSelectValue}
                  onValueChange={(v) => setRoomId(v === "__all_rooms__" ? "" : v)}
                >
                  <SelectTrigger className="relative h-11 rounded-xl border-border bg-background pl-10">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Все кабинеты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_rooms__">Все кабинеты</SelectItem>
                    {roomOptions.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label>
                <span className="block text-xs text-muted-foreground mb-1">Действие</span>
                <Select
                  value={actionSelectValue}
                  onValueChange={(v) => setAction(v === "__all_actions__" ? "" : v)}
                >
                  <SelectTrigger className="relative h-11 rounded-xl border-border bg-background pl-10">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Все действия" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_actions__">Все действия</SelectItem>
                    <SelectItem value="confirmed">Подтверждён</SelectItem>
                    <SelectItem value="rejected">Отклонён</SelectItem>
                    <SelectItem value="scan">Скан</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label>
                <span className="block text-xs text-muted-foreground mb-1">Дата</span>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    type="date"
                    className="w-full pl-10 pr-3 h-11 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-semibold">Нет логов</p>
            <p className="text-sm">Попробуй изменить фильтры или дату</p>
          </div>
        ) : (
          logs.map((l) => {
            const meta = actionMeta(l.action);
            return (
              <div key={l.id} className="p-4 rounded-2xl bg-card border border-border shadow-soft">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${meta.className}`}>
                    <meta.Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm ${meta.className}`}>{meta.label}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          User: <span className="text-foreground">{l.user_name ?? "—"}</span>
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {formatDateTime(l.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {l.user_id != null && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {l.user_id}
                        </span>
                      )}
                      {l.place_number != null && <span>Место #{l.place_number}</span>}
                      {l.teacher_name && <span>Учитель: {l.teacher_name}</span>}
                    </div>

                    {l.details && (
                      <p className="mt-2 text-xs text-foreground/80 whitespace-pre-wrap break-words">
                        {l.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
