import { useState, useEffect } from "react";
import { Users, Check, X, Clock, Search, CheckCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ExitRequest {
  id: number;
  user_name: string;
  created_at: string;
  place_number: number | null;
}

interface AttendanceUser {
  id: number;
  name: string;
  role: string;
  place_number: number | null;
  place_id: number | null;
  confirmation_status: "pending" | "confirmed" | null;
  check_in_time: string;
}

interface TeacherPanelProps {
  roomId?: string;
}

export const TeacherPanel = ({ roomId }: TeacherPanelProps) => {
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceUser[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      const [reqRes, attRes] = await Promise.all([
        apiJson<any>("/api/teacher/requests/"),
        apiJson<any>("/api/teacher/attendance/")
      ]);
      
      if (reqRes.success) setRequests(reqRes.requests);
      if (attRes.success) setAttendance(attRes.users);
    } catch (e) {
      console.error("Failed to fetch teacher data", e);
    } finally {
      setLoadingRequests(false);
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExitAction = async (id: number, action: "approve" | "reject") => {
    try {
      const res = await apiJson<any>(`/api/teacher/requests/${id}/handle/`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (res.success) {
        toast.success(action === "approve" ? "Выход разрешен" : "Запрос отклонен");
        setRequests(prev => prev.filter(r => r.id !== id));
        if (action === "approve") fetchData();
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    }
  };

  const handleConfirm = async (placeId: number) => {
    try {
      const res = await apiJson<any>(`/api/places/${placeId}/confirm/`, { method: "POST" });
      if (res.success) {
        toast.success("Присутствие подтверждено");
        setAttendance(prev => prev.map(u => u.place_id === placeId ? { ...u, confirmation_status: "confirmed" } : u));
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    }
  };

  const handleRemove = async (placeId: number) => {
    try {
      const res = await apiJson<any>(`/api/places/${placeId}/remove/`, { method: "POST" });
      if (res.success) {
        toast.success("Ученик удалён");
        setAttendance(prev => prev.filter(u => u.place_id !== placeId));
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    }
  };

  const handleConfirmAll = async () => {
    if (!roomId) return;
    try {
      const res = await apiJson<any>(`/api/rooms/${roomId}/confirm-all/`, { method: "POST" });
      if (res.success) {
        toast.success(`Подтверждено: ${res.count}`);
        setAttendance(prev => prev.map(u => u.confirmation_status === "pending" ? { ...u, confirmation_status: "confirmed" } : u));
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    }
  };

  const handleRemoveUnconfirmed = async () => {
    if (!roomId) return;
    try {
      const res = await apiJson<any>(`/api/rooms/${roomId}/remove-unconfirmed/`, { method: "POST" });
      if (res.success) {
        toast.success(`Удалено: ${res.count}`);
        setAttendance(prev => prev.filter(u => u.confirmation_status !== "pending"));
        fetchData();
      }
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    }
  };

  const students = attendance.filter(u => u.role === "student" && u.place_id);
  const pendingCount = students.filter(u => u.confirmation_status === "pending").length;

  const filteredStudents = students.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.place_number?.toString().includes(search))
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Панель преподавателя
        </h3>
      </div>

      <Tabs defaultValue="presence" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-10 p-1 bg-secondary/50 rounded-xl">
          <TabsTrigger value="presence" className="rounded-lg text-xs font-semibold relative">
            Присутствие
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-orange-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg text-xs font-semibold relative">
            Запросы
            {requests.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Presence / confirmation tab */}
        <TabsContent value="presence" className="mt-4 animate-in fade-in duration-300">
          {/* Bulk actions */}
          {students.length > 0 && (
            <div className="flex gap-2 mb-3">
              <Button
                onClick={handleConfirmAll}
                disabled={pendingCount === 0}
                size="sm"
                className="flex-1 h-9 rounded-xl text-[11px] font-bold gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Подтвердить всех
              </Button>
              <Button
                onClick={handleRemoveUnconfirmed}
                disabled={pendingCount === 0}
                variant="outline"
                size="sm"
                className="flex-1 h-9 rounded-xl text-[11px] font-bold gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
              >
                <UserX className="w-3.5 h-3.5" />
                Удалить ∅
              </Button>
            </div>
          )}

          {/* Search */}
          {students.length > 3 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Поиск ученика или места..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary/30 border-none text-xs focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              />
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {students.length === 0 ? (
              <div className="bg-secondary/20 rounded-2xl p-8 text-center border border-dashed border-border">
                <p className="text-xs text-muted-foreground">Пока никто не занял место</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Никого не найдено</p>
            ) : (
              filteredStudents.map(u => (
                <div key={u.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      u.confirmation_status === "confirmed"
                        ? "bg-success/10 text-success"
                        : "bg-orange-500/10 text-orange-500"
                    }`}>
                      {u.place_number || "?"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{u.name}</span>
                      <div className="flex items-center gap-1.5">
                        {u.confirmation_status === "confirmed" ? (
                          <span className="text-[10px] text-success font-semibold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Подтверждён
                          </span>
                        ) : (
                          <span className="text-[10px] text-orange-500 font-semibold flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> Ожидание
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {u.confirmation_status === "pending" && (
                      <button
                        onClick={() => handleConfirm(u.place_id!)}
                        className="w-8 h-8 rounded-lg bg-success/10 text-success hover:bg-success/20 flex items-center justify-center transition-colors"
                        title="Подтвердить"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(u.place_id!)}
                      className="w-8 h-8 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      title="Удалить"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
            <span>Всего на местах</span>
            <span className="text-primary">{students.length} чел.</span>
          </div>
        </TabsContent>

        {/* Exit requests tab */}
        <TabsContent value="requests" className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar animate-in fade-in duration-300">
          {loadingRequests && requests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 italic">Загрузка...</p>
          ) : requests.length === 0 ? (
            <div className="bg-secondary/20 rounded-2xl p-8 text-center border border-dashed border-border">
               <div className="w-12 h-12 rounded-full bg-success/5 flex items-center justify-center mx-auto mb-3">
                 <Check className="w-6 h-6 text-success/40" />
               </div>
               <p className="text-xs text-muted-foreground">Пока нет активных запросов на выход</p>
            </div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{r.user_name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Стол {r.place_number || '?'}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExitAction(r.id, "reject")}
                    className="w-9 h-9 rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleExitAction(r.id, "approve")}
                    className="w-9 h-9 rounded-xl bg-success text-success-foreground hover:bg-success/90 flex items-center justify-center transition-colors shadow-sm"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
