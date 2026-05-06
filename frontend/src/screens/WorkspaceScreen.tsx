import { ChevronDown, ScanLine, LogIn, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BottomNav, NavKey } from "@/components/booking/BottomNav";
import { FloorMap } from "@/components/booking/FloorMap";
import { Desk, Room } from "@/types/booking";
import { TeacherPanel } from "@/components/booking/TeacherPanel";
import { LessonConfigModal } from "@/components/booking/LessonConfigModal";

interface WorkspaceScreenProps {
  room: Room;
  myDeskId: number | null;
  isInRoom: boolean;
  onScan: () => void;
  onDeskClick: (desk: Desk) => void;
  onOpenRooms: () => void;
  onNavigate: (key: NavKey) => void;
  onRoomUpdate: (room: Room) => void;
  isAdmin?: boolean;
  userRole?: string;
}

export const WorkspaceScreen = ({
  room,
  myDeskId,
  isInRoom,
  onScan,
  onDeskClick,
  onOpenRooms,
  onNavigate,
  onRoomUpdate,
  isAdmin = false,
  userRole = "student",
}: WorkspaceScreenProps) => {
  const [configOpen, setConfigOpen] = useState(false);
  const isTeacher = userRole === "teacher" || isAdmin;

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-center">
        <h1 className="text-base font-semibold">Мои места</h1>
      </header>

      <div className="px-5 md:px-8 flex items-center justify-between">
        <button
          onClick={onOpenRooms}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground py-1"
        >
          {room.name}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        {isTeacher && isInRoom && (
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setConfigOpen(true)}
            className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary hover:bg-primary/5 gap-1.5"
           >
             <Settings2 className="w-3.5 h-3.5" />
             Настроить урок
           </Button>
        )}
      </div>

      {!isAdmin && !isInRoom ? (
        /* Not checked in — show prompt to scan room QR */
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="w-9 h-9 text-primary" />
          </div>
          <h2 className="text-lg font-bold">Вы не в кабинете</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Отсканируйте QR-код у входа в кабинет, чтобы войти и получить доступ к местам
          </p>
          <Button
            onClick={onScan}
            className="w-full max-w-xs h-12 rounded-xl text-base font-semibold gap-2"
          >
            <ScanLine className="w-5 h-5" />
            Сканировать QR кабинета
          </Button>
        </div>
      ) : (
        /* Checked in (or admin) — show the floor map */
        <div className="flex-1 flex flex-col overflow-y-auto px-5 md:px-8 pt-3 pb-20 custom-scrollbar">
          <FloorMap desks={room.desks} highlightId={myDeskId} onDeskClick={onDeskClick} />

          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" /> Свободно
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive" /> Занято
            </span>
            {myDeskId !== null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-success" /> Моё место
              </span>
            )}
          </div>

          {isTeacher && isInRoom && (
            <TeacherPanel onOpenConfig={() => setConfigOpen(true)} />
          )}
        </div>
      )}

      <BottomNav active="map" isAdmin={isAdmin} onNavigate={onNavigate} />

      <LessonConfigModal 
        open={configOpen} 
        onClose={() => setConfigOpen(false)} 
        room={room}
        onUpdate={onRoomUpdate}
      />
    </div>
  );
};
