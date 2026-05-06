import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Save, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchRoomPlacesAdmin, bulkUpdatePlaces, AdminPlace } from "@/lib/admin";

interface Props {
  roomId: number;
  roomName?: string;
  onBack: () => void;
}

const GRID_COLS = 4;
const GRID_ROWS = 5;

interface CellData {
  number: number;
  x: number;
  y: number;
  status?: string;
}

export const LayoutEditorScreen = ({ roomId, roomName, onBack }: Props) => {
  const [grid, setGrid] = useState<(CellData | null)[][]>(
    Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [editNumber, setEditNumber] = useState("");

  const getNextNumber = (g: (CellData | null)[][]) => {
    const used = new Set<number>();
    g.forEach((row) => row.forEach((cell) => cell && used.add(cell.number)));
    let n = 1;
    while (used.has(n)) n += 1;
    return n;
  };

  const load = useCallback(() => {
    setLoading(true);
    fetchRoomPlacesAdmin(roomId)
      .then((places) => {
        const newGrid: (CellData | null)[][] = Array.from({ length: GRID_ROWS }, () =>
          Array(GRID_COLS).fill(null)
        );
        places.forEach((p) => {
          if (p.x >= 0 && p.x < GRID_COLS && p.y >= 0 && p.y < GRID_ROWS) {
            newGrid[p.y][p.x] = { number: p.number, x: p.x, y: p.y, status: p.status };
          }
        });
        setGrid(newGrid);
      })
      .catch(() => toast.error("Не удалось загрузить места"))
      .finally(() => setLoading(false));
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  const handleCellClick = (row: number, col: number) => {
    const cell = grid[row][col];
    if (cell) {
      setSelectedCell({ x: col, y: row });
      setEditNumber(String(cell.number));
    } else {
      // Create new place
      const newGrid = grid.map((r) => [...r]);
      newGrid[row][col] = { number: getNextNumber(newGrid), x: col, y: row };
      setGrid(newGrid);
      setSelectedCell(null);
      setEditNumber("");
    }
  };

  const handleChangeNumber = () => {
    if (!selectedCell) return;
    const current = grid[selectedCell.y][selectedCell.x];
    if (!current) return;

    const parsed = Number.parseInt(editNumber, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("Номер должен быть положительным числом");
      return;
    }

    const exists = grid.some((row, y) =>
      row.some((cell, x) => !!cell && cell.number === parsed && !(x === selectedCell.x && y === selectedCell.y))
    );
    if (exists) {
      toast.error("Такой номер уже существует");
      return;
    }

    const newGrid = grid.map((r) => [...r]);
    newGrid[selectedCell.y][selectedCell.x] = { ...current, number: parsed };
    setGrid(newGrid);
    toast.success("Номер изменён");
  };

  const handleDeletePlace = () => {
    if (!selectedCell) return;
    const cell = grid[selectedCell.y][selectedCell.x];
    if (cell && cell.status === "occupied") {
      toast.error("Нельзя удалить занятое место");
      return;
    }
    const newGrid = grid.map((r) => [...r]);
    newGrid[selectedCell.y][selectedCell.x] = null;
    setGrid(newGrid);
    setSelectedCell(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const places: { number: number; x: number; y: number }[] = [];
    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          places.push({ number: cell.number, x, y });
        }
      });
    });

    try {
      const res = await bulkUpdatePlaces(roomId, places);
      if (res.success) {
        toast.success(`Сохранено! ${res.places.length} мест`);
        load();
      }
    } catch {
      toast.error("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const placesCount = grid.flat().filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Layout: {roomName || `#${roomId}`}</h1>
          <p className="text-xs text-muted-foreground">{placesCount} мест • Кликайте для добавления</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>

      {/* Selected cell actions */}
      {selectedCell && grid[selectedCell.y][selectedCell.x] && (
        <div className="mx-4 mb-2 p-3 rounded-2xl bg-card border border-border flex items-center gap-3 animate-in slide-in-from-top-1">
          <div className="flex-1">
            <p className="text-sm font-semibold">
              Место #{grid[selectedCell.y][selectedCell.x]!.number}
            </p>
            <p className="text-xs text-muted-foreground">
              Позиция: ({selectedCell.x}, {selectedCell.y})
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                inputMode="numeric"
                className="w-24 px-2.5 py-1.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleChangeNumber}
                className="px-3 py-1.5 rounded-xl bg-primary/15 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                Номер
              </button>
            </div>
          </div>
          <button
            onClick={handleDeletePlace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 text-sm font-medium hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Удалить
          </button>
          <button
            onClick={() => setSelectedCell(null)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="aspect-square max-w-full mx-auto">
            <div
              className="grid gap-1 h-full w-full"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
              }}
            >
              {grid.map((row, y) =>
                row.map((cell, x) => {
                  const isSelected = selectedCell?.x === x && selectedCell?.y === y;
                  const isOccupied = cell?.status === "occupied";
                  return (
                    <button
                      key={`${y}-${x}`}
                      onClick={() => handleCellClick(y, x)}
                      className={`
                        rounded-lg border text-xs font-bold transition-all
                        flex items-center justify-center
                        ${
                          cell
                            ? isOccupied
                              ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                              : isSelected
                              ? "bg-violet-500/30 border-violet-500 text-violet-300 ring-2 ring-violet-500/40 scale-105"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-muted/30 border-border/50 text-muted-foreground/30 hover:bg-muted hover:border-primary/30 hover:text-foreground/50"
                        }
                      `}
                    >
                      {cell ? cell.number : ""}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
          Свободное
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/40" />
          Занятое
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-muted/30 border border-border/50" />
          Пусто
        </span>
      </div>
    </div>
  );
};
