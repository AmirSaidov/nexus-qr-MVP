import { Map, Calendar, Clock, User, Users } from "lucide-react";

export type NavKey = "map" | "bookings" | "history" | "profile" | "admin_users" | "admin_history";

interface BottomNavProps {
  active?: NavKey;
  isAdmin?: boolean;
  onNavigate?: (key: NavKey) => void;
}

export const BottomNav = ({ active = "map", isAdmin = false, onNavigate }: BottomNavProps) => {
  const items = isAdmin
    ? [
        { key: "map" as NavKey, label: "Карта", icon: Map },
        { key: "admin_users" as NavKey, label: "Пользователи", icon: Users },
        { key: "admin_history" as NavKey, label: "История", icon: Clock },
        { key: "profile" as NavKey, label: "Профиль", icon: User },
      ]
    : [
        { key: "map" as NavKey, label: "Карта", icon: Map },
        { key: "profile" as NavKey, label: "Профиль", icon: User },
      ];
  return (
    <nav className="border-t border-border bg-background px-2 pt-2 pb-3">
      <ul className="flex items-center justify-around">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onNavigate?.(key)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
