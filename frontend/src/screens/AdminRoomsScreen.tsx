import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Pencil, LayoutGrid, RefreshCw, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  AdminRoom,
} from "@/lib/admin";

interface Props {
  onBack: () => void;
  onOpenLayout: (roomId: number) => void;
}

export const AdminRoomsScreen = ({ onBack, onOpenLayout }: Props) => {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = () => {
    setLoading(true);
    fetchAdminRooms()
      .then(setRooms)
      .catch(() => toast.error("Не удалось загрузить кабинеты"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await createRoom(newName.trim());
      if (res.success) {
        setRooms((prev) => [...prev, res.room]);
        setNewName("");
        setShowCreate(false);
        toast.success("Кабинет создан");
      }
    } catch {
      toast.error("Ошибка при создании");
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      const res = await updateRoom(id, editName.trim());
      if (res.success) {
        setRooms((prev) => prev.map((r) => (r.id === id ? res.room : r)));
        setEditingId(null);
        toast.success("Кабинет обновлён");
      }
    } catch {
      toast.error("Ошибка при обновлении");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Удалить кабинет "${name}"?`)) return;
    try {
      await deleteRoom(id);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success("Кабинет удалён");
    } catch {
      toast.error("Ошибка при удалении");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Кабинеты</h1>
          <p className="text-xs text-muted-foreground">Управление кабинетами системы</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mx-4 mb-3 p-4 rounded-2xl bg-card border border-border animate-in slide-in-from-top-2">
          <p className="text-sm font-semibold mb-2">Новый кабинет</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Название (например: 407)"
              className="flex-1 px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={handleCreate} className="p-2 rounded-xl bg-emerald-500 text-white hover:opacity-90">
              <Check className="w-5 h-5" />
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(""); }} className="p-2 rounded-xl hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-semibold">Нет кабинетов</p>
            <p className="text-sm">Нажмите + чтобы создать первый</p>
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.id}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/20 transition-all"
            >
              {editingId === room.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(room.id)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button onClick={() => handleUpdate(room.id)} className="p-1.5 rounded-lg bg-emerald-500 text-white">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{room.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{room.places_count} мест</span>
                    <span>•</span>
                    <span>QR: {room.qr_code.slice(0, 16)}…</span>
                    <span>•</span>
                    <span>{formatDate(room.created_at)}</span>
                  </div>
                </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onOpenLayout(room.id)}
                      className="p-2 rounded-lg hover:bg-violet-500/10 text-violet-500 transition-colors"
                      title="Layout Editor"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditingId(room.id); setEditName(room.name); }}
                      className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-500 transition-colors"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, room.name)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
