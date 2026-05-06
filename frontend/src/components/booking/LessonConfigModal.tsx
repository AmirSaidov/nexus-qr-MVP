import { useState } from "react";
import { Settings2, Key, Users, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import { toast } from "sonner";
import { Room } from "@/types/booking";

interface LessonConfigModalProps {
  open: boolean;
  onClose: () => void;
  room: Room;
  onUpdate: (updatedRoom: Room) => void;
}

export const LessonConfigModal = ({ open, onClose, room, onUpdate }: LessonConfigModalProps) => {
  const [mode, setMode] = useState<"password" | "teacher">(room.exitMode || "password");
  const [password, setPassword] = useState(room.exitPassword || "");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (mode === "password" && !password.trim()) {
      toast.error("Установите пароль для выхода");
      return;
    }

    setLoading(true);
    try {
      const res = await apiJson<any>("/api/teacher/config/", {
        method: "POST",
        body: JSON.stringify({
          exit_mode: mode,
          exit_password: password,
        }),
      });
      if (res.success) {
        toast.success("Настройки урока применены");
        onUpdate(res.room);
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">Настройка урока</h2>
              <p className="text-xs text-muted-foreground">Кабинет {room.name.replace("Кабинет ", "")}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Режим выхода учеников
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("password")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    mode === "password"
                      ? "bg-primary/5 border-primary text-primary"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  <Key className="w-5 h-5" />
                  <span className="text-xs font-semibold">По паролю</span>
                </button>
                <button
                  onClick={() => setMode("teacher")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    mode === "teacher"
                      ? "bg-primary/5 border-primary text-primary"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-semibold">Разрешение</span>
                </button>
              </div>
            </div>

            {mode === "password" && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Пароль для учеников
                </label>
                <input
                  type="text"
                  placeholder="Напр. 1234"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Ученики должны будут ввести этот код, чтобы освободить место
                </p>
              </div>
            )}

            {mode === "teacher" && (
              <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-xl border border-border animate-in slide-in-from-top-2 duration-200">
                В этом режиме вам будут приходить уведомления о запросах на выход от учеников.
              </p>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <Button onClick={handleSave} disabled={loading} className="h-12 rounded-xl text-sm font-bold gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Применить для всех
              </Button>
              <button
                onClick={onClose}
                className="h-10 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
