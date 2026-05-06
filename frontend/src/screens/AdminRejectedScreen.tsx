import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, XCircle, Building2, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { fetchRejected, RejectedEntry } from "@/lib/admin";

interface Props {
  onBack: () => void;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const AdminRejectedScreen = ({ onBack }: Props) => {
  const [items, setItems] = useState<RejectedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchRejected()
      .then(setItems)
      .catch(() => toast.error("Не удалось загрузить данные"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Отклонённые</h1>
          <p className="text-xs text-muted-foreground">{items.length} записей</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-semibold">Нет отклонённых</p>
            <p className="text-sm">Здесь появятся записи об отклонённых учениках</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-card border border-border border-l-4 border-l-rose-500"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {item.user_name}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    {item.room_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {item.room_name}
                      </span>
                    )}
                    {item.place_number && <span>Место #{item.place_number}</span>}
                    {item.teacher_name && <span>Учитель: {item.teacher_name}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
