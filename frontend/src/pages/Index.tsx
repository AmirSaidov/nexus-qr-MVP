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
import { AdminDashboardScreen } from "@/screens/AdminDashboardScreen";
import { AdminRoomsScreen } from "@/screens/AdminRoomsScreen";
import { AdminLogsScreen } from "@/screens/AdminLogsScreen";
import { LayoutEditorScreen } from "@/screens/LayoutEditorScreen";
import { AdminRejectedScreen } from "@/screens/AdminRejectedScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { RoomsScreen } from "@/screens/RoomsScreen";
import { NavKey } from "@/components/booking/BottomNav";
import { ScannerModal } from "@/components/qr/ScannerModal";
import { login, register, getUserProfile, updateUserProfile, logout } from "@/lib/auth";
import { occupyPlace, fetchRoomPlaces, fetchRooms, releasePlace, leaveRoom } from "@/lib/places";
import { apiJson, getAuthToken } from "@/lib/api";

import {
  Booking,
  Desk,
  Room,
  Screen,
  UserProfile,
} from "@/types/booking";

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
  const PERSIST_KEY = "nexus_screen_state_v1";
  type PersistedState = {
    screen?: Screen;
    currentRoomId?: string | null;
    scannedDeskId?: number | null;
    bookingTime?: string;
    layoutRoomId?: number | null;
    layoutRoomName?: string;
  };

  const readPersisted = (): PersistedState => {
    try {
      const raw = sessionStorage.getItem(PERSIST_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as PersistedState;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const pickInitialScreen = (): Screen => {
    if (!getAuthToken()) return "login";
    const persisted = readPersisted();
    const s = persisted.screen ?? "workspace";

    // Don’t restore transient/invalid screens
    if (s === "scanner") return "workspace";
    if ((s === "details" || s === "success") && persisted.scannedDeskId == null) return "workspace";
    if (s === "admin_layout" && persisted.layoutRoomId == null) return "admin_rooms";

    return s;
  };

  const [screen, setScreen] = useState<Screen>(() => pickInitialScreen());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => {
    if (!getAuthToken()) return null;
    return readPersisted().currentRoomId ?? null;
  });
  const [scannedDeskId, setScannedDeskId] = useState<number | null>(() => {
    if (!getAuthToken()) return null;
    const v = readPersisted().scannedDeskId;
    return typeof v === "number" ? v : null;
  });
  const [, setScannedData] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [bookingTime, setBookingTime] = useState<string>(() => {
    if (!getAuthToken()) return "";
    return readPersisted().bookingTime ?? "";
  });
  const [isInRoom, setIsInRoom] = useState(false);
  const [layoutRoomId, setLayoutRoomId] = useState<number | null>(() => {
    if (!getAuthToken()) return null;
    const v = readPersisted().layoutRoomId;
    return typeof v === "number" ? v : null;
  });
  const [layoutRoomName, setLayoutRoomName] = useState<string>(() => {
    if (!getAuthToken()) return "";
    return readPersisted().layoutRoomName ?? "";
  });

  const room = useMemo(
    () =>
      rooms.find((r) => r.id === currentRoomId) ??
      rooms[0] ?? {
        id: currentRoomId ?? "",
        name: "",
        floor: 1,
        desks: [],
      },
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

  // Persist current screen/state so refresh (F5) stays on the same page
  useEffect(() => {
    if (!getAuthToken()) {
      try { sessionStorage.removeItem(PERSIST_KEY); } catch { }
      return;
    }

    const next: PersistedState = {
      screen,
      currentRoomId,
      scannedDeskId,
      bookingTime,
      layoutRoomId,
      layoutRoomName,
    };
    try {
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [screen, currentRoomId, scannedDeskId, bookingTime, layoutRoomId, layoutRoomName]);

  useEffect(() => {
    if (getAuthToken()) {
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
        .catch(() => { });

      fetchRooms()
        .then((data) => {
          if (Array.isArray(data)) {
            setRooms((rs) => {
              const updatedRooms = data.map((apiRoom) => {
                const existing = rs.find((r) => r.id === String(apiRoom.id));
                return {
                  id: String(apiRoom.id),
                  name: apiRoom.name,
                  floor: existing?.floor || 1,
                  desks: existing?.desks || [],
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
        .catch(() => { });
    }
  }, [screen]);

  useEffect(() => {
    if (screen === "workspace" && currentRoomId) {
      fetchRoomPlaces(currentRoomId)
        .then((places) => {
          setRooms((rs) =>
            rs.map((r) => {
              if (r.id !== currentRoomId) return r;

              const newDesks: Desk[] = (places ?? []).map((p: any, i: number) => {
                const x = typeof p.x === "number" ? p.x : i % 4;
                const y = typeof p.y === "number" ? p.y : Math.floor(i / 4);

                let st: Desk["status"] = "available";
                if (p.status === "booked" || p.backend_status === "occupied") {
                  st = p.user?.id === user?.id ? "mine" : "occupied";
                }

                return {
                  id: p.number,
                  dbId: p.id,
                  status: st,
                  col: x + 1,
                  row: y + 1,
                  occupiedAt: p.occupied_at,
                  occupantName: p.user?.name || p.user_name || undefined,
                  confirmationStatus: p.confirmation_status || null,
                };
              });

              return { ...r, desks: newDesks };
            })
          );
        })
        .catch(() => { });
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

  const isAdmin = !!(user?.is_staff || user?.role === "admin");
  const isTeacher = (user?.role || "student") === "teacher" || isAdmin;

  const handleLeaveRoom = async () => {
    if (!confirm("Выйти из кабинета?")) return;
    try {
      if (myDeskId) {
        await releasePlace(myDeskId);
      } else {
        await leaveRoom();
      }
      setUser((prev) => ({
        ...prev,
        is_in_room: false,
        current_room: null,
        current_place: null,
      }));
      setScannedDeskId(null);
      setScreen("workspace");
      toast.success("Вы вышли из кабинета");
    } catch {
      toast.error("Не удалось выйти из кабинета");
    }
  };

  const handleNavigate = (key: NavKey | string) => {
    if (key === "map") setScreen("workspace");
    if (key === "profile") setScreen("profile");

    const isAdminKey = String(key).startsWith("admin_");
    if (isAdminKey && !isAdmin) {
      toast.error("Доступ только для администратора");
      return;
    }

    if (key === "admin_users") setScreen("admin_users");
    if (key === "admin_history") setScreen("admin_history");
    if (key === "admin_dashboard") setScreen("admin_dashboard");
    if (key === "admin_rooms") setScreen("admin_rooms");
    if (key === "admin_logs") setScreen("admin_logs");
    if (key === "admin_rejected") setScreen("admin_rejected");
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
              } catch { }
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
              } catch { }
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
          rooms={rooms}
          room={room}
          myDeskId={myDeskId}
          isInRoom={isInRoom}
          onScan={openWorkspaceScanner}
          onDeskClick={handleDeskClick}
          onSelectRoom={(id) => {
            setCurrentRoomId(id);
            setScreen("workspace");
          }}
          onNavigate={handleNavigate}
          onLeaveRoom={isTeacher ? handleLeaveRoom : undefined}
          isAdmin={isAdmin}
          userRole={user?.role || "student"}
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

          onExitSuccess={handleExitComplete}
          isAdmin={isAdmin}
        />
      )}
      {screen === "success" && scannedDesk && (
        <SuccessScreen
          desk={scannedDesk}
          room={room}
          startTime={bookingTime}

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
      {screen === "admin_dashboard" && (
        <AdminDashboardScreen
          onBack={() => setScreen("workspace")}
          onNavigate={handleNavigate}
        />
      )}
      {screen === "admin_rooms" && (
        <AdminRoomsScreen
          onBack={() => setScreen("admin_dashboard")}
          onOpenLayout={(roomId) => {
            setLayoutRoomId(roomId);
            setScreen("admin_layout");
          }}
        />
      )}
      {screen === "admin_layout" && layoutRoomId && (
        <LayoutEditorScreen
          roomId={layoutRoomId}
          roomName={layoutRoomName}
          onBack={() => setScreen("admin_rooms")}
        />
      )}
      {screen === "admin_logs" && (
        <AdminLogsScreen onBack={() => setScreen("admin_dashboard")} />
      )}
      {screen === "admin_rejected" && (
        <AdminRejectedScreen onBack={() => setScreen("admin_dashboard")} />
      )}
      {screen === "profile" && (
        <ProfileScreen
          user={user}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
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

