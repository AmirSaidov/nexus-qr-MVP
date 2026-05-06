import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PhoneFrame } from "@/components/booking/PhoneFrame";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { ForgotPasswordScreen } from "@/screens/ForgotPasswordScreen";
import { WorkspaceScreen } from "@/screens/WorkspaceScreen";
import { DetailsScreen } from "@/screens/DetailsScreen";
import { SuccessScreen } from "@/screens/SuccessScreen";
import { BookingsScreen } from "@/screens/BookingsScreen";
import { AdminUsersScreen } from "@/screens/AdminUsersScreen";
import { AdminHistoryScreen } from "@/screens/AdminHistoryScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { RoomsScreen } from "@/screens/RoomsScreen";
import { NavKey } from "@/components/booking/BottomNav";
import { ScannerModal } from "@/components/qr/ScannerModal";
import { login, register, getUserProfile, updateUserProfile, logout } from "@/lib/auth";
import { occupyPlace, fetchRoomPlaces, fetchRooms, releasePlace } from "@/lib/places";
import { apiJson, getAuthToken } from "@/lib/api";

import {
  Booking,
  Desk,
  Room,
  Screen,
  UserProfile,
} from "@/types/booking";

const initialRooms: Room[] = [
  {
    id: "401",
    name: "Кабинет 401",
    floor: 4,
    desks: [
      // Top row — 4 horizontal desks
      { id: 1, status: "available", col: 2, row: 1, w: 2 },
      { id: 2, status: "available", col: 4, row: 1, w: 2 },
      { id: 3, status: "available", col: 6, row: 1, w: 2 },
      { id: 4, status: "available", col: 8, row: 1, w: 2 },
      // Left column — 2 vertical desks
      { id: 5, status: "available", col: 1, row: 3, h: 2 },
      { id: 6, status: "available", col: 1, row: 5, h: 2 },
      // Right column — 3 vertical desks
      { id: 7, status: "available", col: 10, row: 3, h: 2 },
      { id: 8, status: "available", col: 10, row: 5, h: 2 },
      { id: 9, status: "available", col: 10, row: 7, h: 2 },
    ],
  },
  {
    id: "407",
    name: "Кабинет 407",
    floor: 4,
    desks: [
      // Top row — 1 small portrait + 3 wide desks
      { id: 1, status: "available", col: 2, row: 1, h: 2 },
      { id: 2, status: "available", col: 3, row: 1, w: 2 },
      { id: 3, status: "available", col: 5, row: 1, w: 2 },
      { id: 4, status: "available", col: 7, row: 1, w: 2 },
      // Left column — 2 portrait + 1 landscape at bottom
      { id: 5, status: "available", col: 1, row: 3, h: 2 },
      { id: 6, status: "available", col: 1, row: 5, h: 2 },
      { id: 7, status: "available", col: 1, row: 7, w: 2 },
      // Center — 1 portrait + 1 landscape
      { id: 8, status: "available", col: 5, row: 3, h: 2 },
      { id: 9, status: "available", col: 4, row: 5, w: 2 },
      // Right column — 3 desks
      { id: 10, status: "available", col: 9, row: 3, h: 2 },
      { id: 11, status: "available", col: 9, row: 5, h: 2 },
      { id: 12, status: "available", col: 9, row: 7, h: 2 },
    ],
  },
  {
    id: "302",
    name: "Кабинет 302",
    floor: 3,
    desks: [
      { id: 1, status: "available", col: 1, row: 1, w: 2 },
      { id: 2, status: "available", col: 3, row: 1, w: 2 },
      { id: 3, status: "available", col: 5, row: 1, w: 2 },
      { id: 4, status: "available", col: 1, row: 3, w: 2 },
      { id: 5, status: "available", col: 3, row: 3, w: 2 },
      { id: 6, status: "available", col: 5, row: 3, w: 2 },
    ],
  },
  {
    id: "210",
    name: "Кабинет 210",
    floor: 2,
    desks: [
      { id: 1, status: "available", col: 1, row: 1, h: 2 },
      { id: 2, status: "available", col: 3, row: 1, w: 2 },
      { id: 3, status: "available", col: 5, row: 1, w: 2 },
      { id: 4, status: "available", col: 1, row: 3, w: 2 },
      { id: 5, status: "available", col: 4, row: 3, w: 3 },
    ],
  },
];

const initialUser: UserProfile = {
  name: "Иван Петров",
  email: "ivan.petrov@example.com",
  position: "Frontend-разработчик",
  department: "Команда продукта",
};



const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const Index = () => {
  const [screen, setScreen] = useState<Screen>(getAuthToken() ? "workspace" : "login");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [scannedDeskId, setScannedDeskId] = useState<number | null>(null);
  const [, setScannedData] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [bookingTime, setBookingTime] = useState<string>("");
  const [isInRoom, setIsInRoom] = useState(false);

  const room = useMemo(
    () => rooms.find((r) => r.id === currentRoomId) ?? rooms[0] ?? initialRooms[0],
    [rooms, currentRoomId]
  );
  const myDeskId = useMemo(() => {
    const mine = room.desks.find((d) => d.status === "mine");
    return mine ? mine.id : null;
  }, [room.desks]);
  
  const hasActiveBooking = useMemo(() => {
    return bookings.some(b => b.status === "active");
  }, [bookings]);

  const scannedDesk = useMemo(
    () => room.desks.find((d) => d.id === scannedDeskId) ?? null,
    [room, scannedDeskId]
  );

  // Global 401 handler: if any API call gets 401, force logout
  useEffect(() => {
    const handler = () => {
      setUser(initialUser);
      setBookings([]);
      setScreen("login");
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  useEffect(() => {
    if (screen === "workspace" || screen === "profile") {
      getUserProfile()
        .then((data) => {
          if (data && data.email) {
            setUser((prev) => ({ ...prev, ...data }));
            // Sync is_in_room from server
            setIsInRoom(!!data.is_in_room);
            if (data.current_room) {
              setCurrentRoomId(String(data.current_room));
            }
          }
        })
        .catch(() => {});

      fetchRooms()
        .then((data) => {
          if (Array.isArray(data)) {
            setRooms((rs) => {
              const updatedRooms = data.map((apiRoom) => {
                const apiName = apiRoom.name.toLowerCase();
                const existing = rs.find((r) => r.id === String(apiRoom.id)) ||
                                 initialRooms.find((r) => apiName.includes(r.id) || r.name.toLowerCase().includes(apiName));
                return {
                  id: String(apiRoom.id),
                  name: apiRoom.name,
                  floor: existing?.floor || 1,
                  desks: existing?.desks || [],
                  exitMode: apiRoom.exit_mode as "password" | "teacher" || "password",
                };
              });
              if (!currentRoomId && updatedRooms.length > 0) {
                setTimeout(() => {
                  setCurrentRoomId((prev) => prev || updatedRooms[0].id);
                }, 100);
              }
              return updatedRooms;
            });
          }
        })
        .catch(() => {});
    }
  }, [screen]);

  useEffect(() => {
    if (screen === "workspace" && currentRoomId) {
      fetchRoomPlaces(currentRoomId)
        .then((places) => {
          setRooms((rs) =>
            rs.map((r) => {
              if (r.id !== currentRoomId) return r;
              
              // If room had no layout (created via admin), generate simple grid
              let desks = [...r.desks];
              if (desks.length === 0 && places.length > 0) {
                desks = places.map((p: any, i: number) => ({
                  id: p.number,
                  status: "available",
                  col: (i % 6) + 1,
                  row: Math.floor(i / 6) * 2 + 1,
                }));
              }

              const newDesks = desks.map((desk) => {
                const p = places.find((x: any) => x.number === desk.id);
                if (p) {
                  let st: Desk["status"] = "available";
                  if (p.status === "booked" || p.backend_status === "occupied") {
                    st = p.user?.id === user?.id ? "mine" : "occupied";
                  }
                  return { 
                    ...desk, 
                    dbId: p.id, 
                    status: st,
                    occupiedAt: p.occupied_at,
                    occupantName: p.user?.name || p.user_name || undefined
                  };
                }
                return desk;
              });
              return { ...r, desks: newDesks };
            })
          );
        })
        .catch(() => {});
    }
  }, [screen, currentRoomId, user?.id]);

  const updateDesk = (roomId: string, id: number, status: Desk["status"]) => {
    setRooms((rs) =>
      rs.map((r) =>
        r.id !== roomId
          ? r
          : { ...r, desks: r.desks.map((d) => (d.id === id ? { ...d, status } : d)) }
      )
    );
  };

  const extractDeskId = (text: string) => {
    const m = text.match(/\d+/);
    if (!m) return null;
    const id = Number(m[0]);
    return Number.isFinite(id) ? id : null;
  };

  const parsePlaceIdFromQr = (decodedText: string) => {
    try {
      const url = new URL(decodedText);
      const parts = url.pathname.split("/").filter(Boolean);
      const placeIdx = parts.findIndex((p) => p === "place" || p === "places");
      if (placeIdx === -1) return extractDeskId(decodedText);
      const idPart = parts[placeIdx + 1];
      const id = Number(idPart);
      return Number.isFinite(id) ? id : null;
    } catch {
      return extractDeskId(decodedText);
    }
  };

  const openWorkspaceScanner = () => {
    setScannerOpen(true);
  };



  const handleDecoded = async (decodedText: string) => {
    console.log(decodedText);
    setScannerOpen(false);

    try {
      const res = await apiJson<any>("/api/rooms/enter", {
        method: "POST",
        body: JSON.stringify({ qr_code: decodedText }),
      });
      if (res.success) {
        setIsInRoom(true);
        const roomId = String(res.room.id);
        setCurrentRoomId(roomId);
        setUser(prev => ({ ...prev, is_in_room: true, current_room: res.room.id }));
        toast.success(`Вы вошли в ${res.room.name}`);
      } else {
        toast.error(res.message || "Не удалось войти в кабинет");
      }
    } catch (e: any) {
      toast.error(e?.message || "QR-код не распознан");
    }
  };

  const handleBook = () => {
    if (!scannedDesk) return;
    if (hasActiveBooking) {
      toast.error("Вы уже заняли место");
      return;
    }
    if (!scannedDesk.dbId) {
      toast.error("Ошибка: место не привязано к серверу");
      return;
    }

    void (async () => {
      try {
        await occupyPlace(scannedDesk.dbId!);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось занять место";
        toast.error(msg);
        return;
      }

      updateDesk(room.id, scannedDesk.id, "mine");
      const time = nowHM();
      setBookingTime(time);
      setScreen("success");
      toast.success(`Стол ${scannedDesk.id} занят`);
    })();
  };

  const handleRelease = () => {
    const userRole = user?.role || "student";
    if (!myDeskId) {
      setScannedDeskId(null);
      setScreen("workspace");
      return;
    }
    const mineDesk = room.desks.find((d) => d.id === myDeskId);
    if (!mineDesk || !mineDesk.dbId) return;

    void (async () => {
      try {
        await releasePlace(mineDesk.dbId!);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось освободить место";
        toast.error(msg);
        return;
      }

      updateDesk(room.id, myDeskId, "available");
      setBookings(prev => prev.filter(b => b.status !== "active"));
      toast.success("Место освобождено");
      setScannedDeskId(null);
      setScreen("workspace");
    })();
  };

  const handleCancelBooking = async (id: string) => {
    const b = bookings.find((x) => x.id === id);
    if (!b || !b.dbId) return;

    try {
      await releasePlace(b.dbId);
      updateDesk(b.roomId, b.deskId, "available");
      setBookings(prev => prev.filter(x => x.id !== id));
      toast.success("Место освобождено");
    } catch (e) {
      toast.error("Не удалось освободить место");
    }
  };

  const handleExitComplete = () => {
    setIsInRoom(false);
    setUser(prev => ({ ...prev, is_in_room: false, current_room: null, current_place: null }));
    if (myDeskId) {
      updateDesk(room.id, myDeskId, "available");
    }
    setBookings(prev => prev.filter(b => b.status !== "active"));
    setScannedDeskId(null);
    setScreen("workspace");
  };

  const handleDeskClick = (desk: Desk) => {
    setScannedDeskId(desk.id);
    setScreen("details");
  };

  const handleNavigate = (key: NavKey) => {
    if (key === "map") setScreen("workspace");
    if (key === "profile") setScreen("profile");
    if (key === "admin_users") setScreen("admin_users");
    if (key === "admin_history") setScreen("admin_history");
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    try {
      const updated = await updateUserProfile(data);
      setUser(prev => ({ ...prev, ...updated }));
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error("Не удалось обновить профиль");
    }
  };

  const handleLogout = () => {
    // Reset user state so next person doesn't see stale is_staff
    logout();
    setUser(initialUser);
    setBookings([]);
    setScreen("login");
    toast.success("Вы вышли из аккаунта");
  };

  return (
    <PhoneFrame>
      {screen === "login" && (
        <LoginScreen
          onLogin={async ({ email, password }) => {
            try {
              await login(email, password);
              // Fetch fresh profile so is_staff is correct for this account
              try {
                const profile = await getUserProfile();
                setUser((prev) => ({ ...prev, ...profile }));
              } catch {}
              setScreen("workspace");
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Не удалось войти";
              toast.error(msg);
            }
          }}
          onRegister={() => setScreen("register")}
          onForgot={() => setScreen("forgot")}
        />
      )}
      {screen === "register" && (
        <RegisterScreen
          onRegister={async ({ name, email, password }) => {
            try {
              await register(name, email, password);
              // After registration, log in automatically and load fresh profile
              await login(email, password);
              try {
                const profile = await getUserProfile();
                setUser({ ...initialUser, ...profile });
              } catch {}
              setScreen("workspace");
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Не удалось зарегистрироваться";
              toast.error(msg);
            }
          }}
          onBack={() => setScreen("login")}
        />
      )}
      {screen === "forgot" && (
        <ForgotPasswordScreen onBack={() => setScreen("login")} />
      )}
      {screen === "workspace" && currentRoomId && (
        <WorkspaceScreen
          room={room}
          myDeskId={myDeskId}
          isInRoom={isInRoom}
          onScan={openWorkspaceScanner}
          onDeskClick={handleDeskClick}
          onOpenRooms={() => setScreen("rooms")}
          onNavigate={handleNavigate}
          isAdmin={user?.is_staff}
          userRole={user?.role || "student"}
          onRoomUpdate={(apiRoom: any) => {
            setRooms(prev => prev.map(r => 
              r.id === String(apiRoom.id) 
                ? { 
                    ...r, 
                    exitMode: apiRoom.exit_mode, 
                    exitPassword: apiRoom.exit_password 
                  } 
                : r
            ));
          }}
        />
      )}
      {screen === "details" && scannedDesk && (
        <DetailsScreen
          desk={scannedDesk}
          room={room}
          onBack={() => setScreen("workspace")}
          onBook={handleBook}
          onRelease={handleRelease}
          userRole={user?.role || "student"}
          exitMode={room.exitMode || "password"}
          onExitSuccess={handleExitComplete}
          isAdmin={user?.is_staff}
        />
      )}
      {screen === "success" && scannedDesk && (
        <SuccessScreen
          desk={scannedDesk}
          room={room}
          startTime={bookingTime}
          exitMode={room.exitMode || "password"}
          userRole={user?.role || "student"}
          onRelease={handleRelease}
          onExitSuccess={handleExitComplete}
          onHome={() => setScreen("workspace")}
        />
      )}
      {screen === "admin_users" && (
        <AdminUsersScreen onBack={() => setScreen("workspace")} />
      )}
      {screen === "admin_history" && (
        <AdminHistoryScreen onBack={() => setScreen("workspace")} />
      )}
      {screen === "profile" && (
        <ProfileScreen
          user={user}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          isAdmin={user?.is_staff}
        />
      )}

      {screen === "rooms" && (
        <RoomsScreen
          rooms={rooms}
          currentRoomId={currentRoomId}
          onBack={() => setScreen("workspace")}
          onSelect={(id) => {
            setCurrentRoomId(id);
            setScreen("workspace");
          }}
        />
      )}

      <ScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        title="Сканирование QR кабинета"
        onDecode={handleDecoded}
      />
    </PhoneFrame>
  );
};

export default Index;

