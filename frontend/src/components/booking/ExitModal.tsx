import { useState, useEffect } from "react";
import { LogOut, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestExit, confirmExit, getExitStatus } from "@/lib/places";
import { toast } from "sonner";

interface ExitModalProps {
  open: boolean;
  exitMode: "password" | "teacher";
  onExitSuccess: () => void;
  onClose: () => void;
}

export const ExitModal = ({ open, exitMode, onExitSuccess, onClose }: ExitModalProps) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"pending" | "approved" | "rejected" | null>(null);

  // Poll status every 3s when request is sent
  useEffect(() => {
    if (!requestSent || requestStatus !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await getExitStatus();
        // If status is approved OR user is already not in room (means teacher released them)
        if (res.status === "approved" || res.status === "not_in_room") {
          setRequestStatus("approved");
          clearInterval(interval);
          toast.success("Преподаватель разрешил выход!");
          setTimeout(() => onExitSuccess(), 1000);
        } else if (res.status === "rejected") {
          setRequestStatus("rejected");
          clearInterval(interval);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [requestSent, requestStatus, onExitSuccess]);

  if (!open) return null;

  const handlePasswordExit = async () => {
    if (!password.trim()) {
      toast.error("Введите пароль");
      return;
    }
    setLoading(true);
    try {
      const res = await confirmExit(password);
      if (res.success) {
        toast.success("Выход разрешён!");
        onExitSuccess();
      } else {
        toast.error(res.message || "Неверный пароль");
      }
    } catch (e: any) {
      toast.error(e?.message || "Неверный пароль");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestExit = async () => {
    setLoading(true);
    try {
      const res = await requestExit();
      if (res.success) {
        setRequestSent(true);
        setRequestStatus("pending");
      } else {
        toast.error(res.message || "Ошибка запроса");
      }
    } catch (e: any) {
      toast.error(e?.message || "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-card rounded-t-3xl p-6 pb-10 shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-5 w-10 h-1 rounded-full bg-border" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-base font-bold">Выход из кабинета</h2>
            <p className="text-xs text-muted-foreground">
              {exitMode === "password" ? "Введите пароль от преподавателя" : "Запросите разрешение у преподавателя"}
            </p>
          </div>
        </div>

        {exitMode === "password" ? (
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Пароль для выхода"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordExit()}
              className="w-full h-12 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <Button
              onClick={handlePasswordExit}
              disabled={loading}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Подтвердить выход"}
            </Button>
            <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground py-1 hover:text-foreground transition-colors">
              Отмена
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {!requestSent ? (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Нажмите кнопку, чтобы отправить запрос преподавателю. Когда он разрешит выход — вы автоматически покинете кабинет.
                </p>
                <Button
                  onClick={handleRequestExit}
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-sm font-semibold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Запросить выход"}
                </Button>
                <button onClick={onClose} className="w-full text-center text-sm text-muted-foreground py-1 hover:text-foreground transition-colors">
                  Отмена
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                {requestStatus === "pending" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <p className="text-base font-semibold">Ожидание разрешения</p>
                    <p className="text-sm text-muted-foreground text-center">Запрос отправлен преподавателю. Ожидайте...</p>
                  </>
                )}
                {requestStatus === "approved" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-success" />
                    </div>
                    <p className="text-base font-semibold text-success">Выход разрешён!</p>
                  </>
                )}
                {requestStatus === "rejected" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <p className="text-base font-semibold text-destructive">Отклонено</p>
                    <p className="text-sm text-muted-foreground text-center">Преподаватель отклонил запрос</p>
                    <button
                      onClick={() => { setRequestSent(false); setRequestStatus(null); }}
                      className="text-sm text-primary font-semibold hover:underline"
                    >
                      Попробовать снова
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
