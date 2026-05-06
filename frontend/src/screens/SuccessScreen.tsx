import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExitModal } from "@/components/booking/ExitModal";
import { Desk, Room } from "@/types/booking";

interface SuccessScreenProps {
  desk: Desk;
  room: Room;
  startTime: string;
  exitMode: "password" | "teacher";
  userRole: string;
  onRelease: () => void;
  onExitSuccess: () => void;
  onHome: () => void;
}

export const SuccessScreen = ({
  desk,
  room,
  startTime,
  exitMode,
  userRole,
  onRelease,
  onExitSuccess,
  onHome,
}: SuccessScreenProps) => {
  const [exitModalOpen, setExitModalOpen] = useState(false);

  const handleExitClick = () => {
    if (userRole === "teacher" || userRole === "admin") {
      onRelease();
      return;
    }
    setExitModalOpen(true);
  };

  const exitLabel =
    userRole === "student"
      ? exitMode === "password"
        ? "Выйти (ввести пароль)"
        : "Запросить выход"
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

        {userRole === "student" && (
          <p className="mt-6 text-xs text-muted-foreground bg-secondary px-4 py-2 rounded-xl">
            {exitMode === "password"
              ? "🔒 Для выхода из кабинета потребуется пароль преподавателя"
              : "🔒 Для выхода необходимо разрешение преподавателя"}
          </p>
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
        exitMode={exitMode}
        onExitSuccess={() => {
          setExitModalOpen(false);
          onExitSuccess();
        }}
        onClose={() => setExitModalOpen(false)}
      />
    </div>
  );
};