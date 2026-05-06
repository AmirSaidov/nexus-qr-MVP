import { ScanLine, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BottomNav, NavKey } from "@/components/booking/BottomNav";
import { FloorMap } from "@/components/booking/FloorMap";
import { Desk, Room } from "@/types/booking";
import { TeacherPanel } from "@/components/booking/TeacherPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


interface WorkspaceScreenProps {
  rooms: Room[];
  room: Room;
  myDeskId: number | null;
  isInRoom: boolean;
  onScan: () => void;
  onDeskClick: (desk: Desk) => void;
  onSelectRoom: (roomId: string) => void;
  onNavigate: (key: NavKey) => void;
  onLeaveRoom?: () => void;

  isAdmin?: boolean;
  userRole?: string;
}

export const WorkspaceScreen = ({
  rooms,
  room,
  myDeskId,
  isInRoom,
  onScan,
  onDeskClick,
  onSelectRoom,
  onNavigate,
  onLeaveRoom,

  isAdmin = false,
  userRole = "student",
}: WorkspaceScreenProps) => {

  const isTeacher = userRole === "teacher" || isAdmin;

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-center">
        <h1 className="text-base font-semibold">Мои места</h1>
      </header>

      <div className="px-5 md:px-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Select value={room.id} onValueChange={onSelectRoom}>
            <SelectTrigger className="h-9 rounded-xl border-border bg-card/40 px-3">
              <SelectValue placeholder="Кабинет" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isTeacher && isInRoom && onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-sm font-semibold"
            title="Выйти из кабинета"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
            Выйти
          </button>
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
            <TeacherPanel roomId={room.id} />
          )}
        </div>
      )}

      <BottomNav active="map" isAdmin={isAdmin} onNavigate={onNavigate} />


    </div>
  );
};
