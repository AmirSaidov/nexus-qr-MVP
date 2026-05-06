import { useState, useEffect } from "react";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExitModal } from "@/components/booking/ExitModal";
import { Desk, Room } from "@/types/booking";
import { apiJson } from "@/lib/api";

interface SuccessScreenProps {
  desk: Desk;
  room: Room;
  startTime: string;
  userRole: string;
  onRelease: () => void;
  onExitSuccess: () => void;
  onHome: () => void;
}

export const SuccessScreen = ({
  desk,
  room,
  startTime,
  userRole,
  onRelease,
  onExitSuccess,
  onHome,
}: SuccessScreenProps) => {
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<"pending" | "confirmed" | null>(
    desk.confirmationStatus || "pending"
  );

  // Poll confirmation status every 3s for students
  useEffect(() => {
    if (userRole !== "student" || !desk.dbId) return;

    const poll = async () => {
      try {
        const places = await apiJson<any[]>(`/api/rooms/${room.id}/places`);
        const myPlace = places.find((p: any) => p.id === desk.dbId);
        if (myPlace?.confirmation_status) {
          setConfirmationStatus(myPlace.confirmation_status);
        }
      } catch { }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [userRole, desk.dbId, room.id]);

  const handleExitClick = () => {
    if (userRole === "teacher" || userRole === "admin") {
      onRelease();
      return;
    }
    setExitModalOpen(true);
  };

  const exitLabel =
    userRole === "student"
      ? "Запросить выход"
      : "Освободить место";

  return (
    <div className="flex-1 flex flex-col bg-background px-6 pt-12 pb-8">
      <div className="flex-1 flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-success/20 blur-xl" />
          <div className="relative w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-soft">
            <Check className="w-10 h-10 text-success-foreground" strokeWidth={3} />
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          Место занято!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Стол {desk.id}, кабинет {room.name.replace("Кабинет ", "")}
        </p>

        <div className="mt-8 w-full">
          <p className="text-xs text-muted-foreground">Время начала</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{startTime}</p>
        </div>

        {userRole === "student" && confirmationStatus === "pending" && (
          <div className="mt-6 w-full flex items-center gap-3 bg-orange-500/10 px-4 py-3 rounded-xl border border-orange-500/20 animate-in fade-in duration-300">
            <Clock className="w-5 h-5 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-600 text-left font-medium leading-tight">
              Ожидает подтверждения преподавателем. Оставайтесь на месте.
            </p>
          </div>
        )}

        {userRole === "student" && confirmationStatus === "confirmed" && (
          <div className="mt-6 w-full flex items-center gap-3 bg-success/10 px-4 py-3 rounded-xl border border-success/20 animate-in fade-in duration-300">
            <Check className="w-5 h-5 text-success shrink-0" />
            <p className="text-xs text-success text-left font-medium leading-tight">
              Преподаватель подтвердил ваше присутствие
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 items-center">
        <Button
          onClick={handleExitClick}
          variant="outline"
          className="w-full h-12 rounded-xl text-base font-semibold border-border"
        >
          {exitLabel}
        </Button>
        <button
          onClick={onHome}
          className="text-primary font-semibold text-sm py-2 hover:underline"
        >
          На главную
        </button>
      </div>

      <ExitModal
        open={exitModalOpen}
        onExitSuccess={() => {
          setExitModalOpen(false);
          onExitSuccess();
        }}
        onClose={() => setExitModalOpen(false)}
      />
    </div>
  );
};