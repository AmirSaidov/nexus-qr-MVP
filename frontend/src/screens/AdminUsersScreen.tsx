import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Search } from "lucide-react";
import { fetchAdminUsers } from "@/lib/auth";

interface AdminUsersScreenProps {
  onBack: () => void;
}

export const AdminUsersScreen = ({ onBack }: AdminUsersScreenProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setError(null);
    fetchAdminUsers()
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch((e: any) => {
        setError(e?.message || "Failed to load users");
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter(u =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <header className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-border">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-foreground -ml-1.5 justify-self-start"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
        <h1 className="text-base font-semibold">Пользователи</h1>
        <div className="w-8" />
      </header>

      <div className="px-5 md:px-8 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex-1 px-5 md:px-8 pt-2 pb-6 space-y-3 overflow-y-auto">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground mt-8">Загрузка...</div>
        ) : error ? (
          <div className="text-center text-sm text-destructive mt-8">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-8">Ничего не найдено</div>
        ) : (
          filteredUsers.map((u) => (
            <article
              key={u.id}
              className="rounded-2xl border border-border bg-card shadow-soft p-4"
            >
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                  {(u.name || u.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold truncate">{u.name || "Без имени"}</h2>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>

                  {u.place ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-medium">
                      <MapPin className="w-3 h-3" />
                      <span>{u.place.room_name}, Стол {u.place.number}</span>
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-secondary text-muted-foreground px-2.5 py-1 rounded-full text-[10px] font-medium">
                      <span>Не в офисе</span>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
