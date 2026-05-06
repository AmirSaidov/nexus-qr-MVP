import { apiJson } from "@/lib/api";

export async function occupyPlace(placeId: number, qrCode?: string) {
  return apiJson<{ success: boolean }>(`/api/places/${placeId}/occupy`, {
    method: "POST",
    body: JSON.stringify({ qr_code: qrCode }),
  });
}

export async function fetchRoomPlaces(roomId: string) {
  return apiJson<any[]>(`/api/rooms/${roomId}/places`);
}

export async function fetchRooms() {
  return apiJson<any[]>("/api/rooms");
}

export async function releasePlace(placeId: number) {
  return apiJson<{ success: boolean }>(`/api/places/${placeId}/leave`, {
    method: "POST",
  });
}

export async function leaveRoom() {
  return apiJson<{ success: boolean; message?: string }>("/api/rooms/leave", {
    method: "POST",
  });
}

export async function requestExit() {
  return apiJson<{ success: boolean; message: string }>("/api/exit/request/", {
    method: "POST",
  });
}


export async function getExitStatus() {
  return apiJson<{ success: boolean; status: string }>("/api/exit/status/");
}
