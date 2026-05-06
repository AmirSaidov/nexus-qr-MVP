import { MapPin, Calendar, Trash2 } from "lucide-react";
import { BottomNav, NavKey } from "@/components/booking/BottomNav";
import { Booking } from "@/types/booking";

interface Props {
  bookings: Booking[];
  isAdmin?: boolean;
  onNavigate: (key: NavKey) => void;
  onClearHistory: () => void;
}

export const HistoryScreen = ({ bookings, isAdmin = false, onNavigate, onClearHistory }: Props) => {
  const allBookings = bookings;

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between">
        <div className="w-8" />
        <h1 className="text-base font-semibold">История</h1>
        <button onClick={onClearHistory} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 px-5 md:px-8 pt-2 pb-4 space-y-3 overflow-y-auto">
        {allBookings.length === 0 && (
          <div className="mt-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Calendar className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">История пуста</p>
          </div>
        )}

        {allBookings.map((b) => (
          <article
            key={b.id}
            className="rounded-2xl border border-border bg-card shadow-soft p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">Стол {b.deskId}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{b.date}</p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  b.status === "active"
                    ? "bg-primary text-primary-foreground"
                    : b.status === "completed"
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {b.status === "active" ? "Активна" : b.status === "completed" ? "Завершена" : "Отменена"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {b.roomName}
              {b.endTime && (
                <span className="ml-auto tabular-nums">
                  {b.startTime}–{b.endTime}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      <BottomNav active="history" isAdmin={isAdmin} onNavigate={onNavigate} />
    </div>
  );
};
