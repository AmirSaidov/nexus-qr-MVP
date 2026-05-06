import { useState } from "react";
import { Calendar, MapPin, Clock, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav, NavKey } from "@/components/booking/BottomNav";
import { ExitModal } from "@/components/booking/ExitModal";
import { Booking } from "@/types/booking";

interface Props {
  bookings: Booking[];
  exitMode: "password" | "teacher";
  userRole: string;
  onExitSuccess: (id: string) => void;
  onScan: () => void;
  onNavigate: (key: NavKey) => void;
}

export const BookingsScreen = ({ bookings, exitMode, userRole, onExitSuccess, onScan, onNavigate }: Props) => {
  const active = bookings.filter((b) => b.status === "active");
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitTargetId, setExitTargetId] = useState<string | null>(null);

  const handleExitClick = (id: string) => {
    // Teachers and admins can leave freely
    if (userRole === "teacher" || userRole === "admin") {
      onExitSuccess(id);
      return;
    }
    setExitTargetId(id);
    setExitModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="px-5 md:px-8 pt-4 pb-3 text-center">
        <h1 className="text-base font-semibold">Мои места</h1>
      </header>

      <div className="flex-1 px-5 md:px-8 pt-2 pb-4 space-y-3 overflow-y-auto">
        {active.length === 0 && (
          <div className="mt-16 text-center">
            <div className="mx-auto w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Вы пока не заняли ни одного места</p>
            <Button onClick={onScan} variant="outline" className="mt-6 h-12 px-8 rounded-xl border-primary text-primary hover:bg-primary/5 hover:text-primary gap-2 text-sm font-semibold">
              <QrCode className="w-4 h-4" /> Сканировать QR
            </Button>
          </div>
        )}

        {active.map((b) => (
          <article
            key={b.id}
            className="rounded-2xl border border-border bg-card shadow-card p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Стол {b.deskId}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Активна</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success">
                Активна
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row icon={<MapPin className="w-4 h-4" />} label={b.roomName} />
              <Row icon={<Calendar className="w-4 h-4" />} label={b.date} />
              <Row icon={<Clock className="w-4 h-4" />} label={`с ${b.startTime}`} />
            </dl>
            <Button
              onClick={() => handleExitClick(b.id)}
              variant="outline"
              className="mt-4 w-full h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              {userRole === "student" ? (exitMode === "password" ? "Выйти (пароль)" : "Запросить выход") : "Освободить"}
            </Button>
          </article>
        ))}
      </div>

      <BottomNav active="bookings" onNavigate={onNavigate} />

      <ExitModal
        open={exitModalOpen}
        exitMode={exitMode}
        onExitSuccess={() => {
          setExitModalOpen(false);
          if (exitTargetId) onExitSuccess(exitTargetId);
        }}
        onClose={() => setExitModalOpen(false)}
      />
    </div>
  );
};

const Row = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2 text-foreground">
    <span className="text-muted-foreground">{icon}</span>
    <span>{label}</span>
  </div>
);
