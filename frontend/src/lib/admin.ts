import { apiJson } from "./api";

// ─── Dashboard ──────────────────────────────────────────────────────
export interface DashboardStats {
  active_rooms: number;
  students_in_system: number;
  pending: number;
  confirmed: number;
  rejected_today: number;
}

export const fetchDashboard = () =>
  apiJson<DashboardStats>("/api/admin/dashboard/");

// ─── Rooms ──────────────────────────────────────────────────────────
export interface AdminRoom {
  id: number;
  name: string;
  qr_code: string;
  places_count: number;
  created_at: string;
}

export const fetchAdminRooms = () => apiJson<AdminRoom[]>("/api/admin/rooms/");

export const createRoom = (name: string) =>
  apiJson<{ success: boolean; room: AdminRoom }>("/api/admin/rooms/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const updateRoom = (id: number, name: string) =>
  apiJson<{ success: boolean; room: AdminRoom }>(`/api/admin/rooms/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

export const deleteRoom = (id: number) =>
  apiJson<{ success: boolean }>(`/api/admin/rooms/${id}/`, {
    method: "DELETE",
  });

// ─── Layout / Places ────────────────────────────────────────────────
export interface AdminPlace {
  id: number;
  number: number;
  x: number;
  y: number;
  status: string;
  user_name?: string | null;
}

export const fetchRoomPlacesAdmin = (roomId: number) =>
  apiJson<AdminPlace[]>(`/api/admin/rooms/${roomId}/places/`);

export const bulkUpdatePlaces = (
  roomId: number,
  places: { number: number; x: number; y: number }[]
) =>
  apiJson<{ success: boolean; places: AdminPlace[] }>(
    `/api/admin/rooms/${roomId}/places/bulk/`,
    {
      method: "POST",
      body: JSON.stringify({ places }),
    }
  );

// ─── Logs ───────────────────────────────────────────────────────────
export interface AdminLogEntry {
  id: number;
  action: string;
  user_name: string | null;
  user_id: number | null;
  teacher_name: string | null;
  teacher_id: number | null;
  room_name: string | null;
  room_id: number | null;
  place_number: number | null;
  place_id: number | null;
  details: string;
  created_at: string;
}

export const fetchLogs = (params?: {
  room_id?: string;
  action?: string;
  date?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.room_id) q.set("room_id", params.room_id);
  if (params?.action) q.set("action", params.action);
  if (params?.date) q.set("date", params.date);
  const qs = q.toString();
  return apiJson<AdminLogEntry[]>(`/api/admin/logs/${qs ? `?${qs}` : ""}`);
};

// ─── Rejected ───────────────────────────────────────────────────────
export interface RejectedEntry {
  id: number;
  user_name: string;
  teacher_name: string | null;
  room_name: string | null;
  place_number: number | null;
  created_at: string;
}

export const fetchRejected = () =>
  apiJson<RejectedEntry[]>("/api/admin/rejected/");
