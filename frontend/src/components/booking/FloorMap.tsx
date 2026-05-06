import { Desk } from "@/types/booking";

interface FloorMapProps {
  desks: Desk[];
  highlightId?: number | null;
  onDeskClick?: (desk: Desk) => void;
}

const STATUS_DOT: Record<Desk["status"], string> = {
  available: "bg-success",
  occupied: "bg-destructive",
  mine: "bg-success",
};

export const FloorMap = ({ desks, highlightId, onDeskClick }: FloorMapProps) => {
  const minCol = desks.length
    ? desks.reduce((m, d) => Math.min(m, d.col), Number.POSITIVE_INFINITY)
    : 1;
  const minRow = desks.length
    ? desks.reduce((m, d) => Math.min(m, d.row), Number.POSITIVE_INFINITY)
    : 1;

  const maxCol = desks.length
    ? desks.reduce((m, d) => Math.max(m, d.col + (d.w ?? 1) - 1), 1)
    : 1;
  const maxRow = desks.length
    ? desks.reduce((m, d) => Math.max(m, d.row + (d.h ?? 1) - 1), 1)
    : 1;

  const totalCols = Math.max(1, maxCol - minCol + 1);
  const totalRows = Math.max(1, maxRow - minRow + 1);

  return (
    <div className="w-full flex justify-center py-2">
      <div className="w-full max-w-[560px] bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
        {/* Subtle background grid texture */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
            `,
            backgroundSize: "18px 18px",
          }}
        />
        
        <div
          className="relative grid w-full gap-1.5 sm:gap-2"
          style={{
            aspectRatio: `${totalCols} / ${totalRows * 1.05}`,
            gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
            gridTemplateRows: `repeat(${totalRows}, 1fr)`,
          }}
        >
          {desks.map((d) => {
            const isMine = d.status === "mine" || d.id === highlightId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onDeskClick?.(d)}
                className={`
                  relative rounded-lg border transition-all duration-300
                  flex items-center justify-center text-[11px] sm:text-xs font-bold
                  active:scale-95 hover:scale-[1.02]
                  ${isMine 
                    ? "bg-success border-success text-success-foreground shadow-[0_0_20px_hsl(var(--success)/0.3)]" 
                    : d.status === "occupied"
                      ? "bg-destructive/10 border-destructive/20 text-foreground/30"
                      : "bg-background border-border text-foreground hover:border-foreground/30 hover:bg-secondary"
                  }
                `}
                style={{
                  gridColumn: `${d.col - minCol + 1} / span ${d.w ?? 1}`,
                  gridRow: `${d.row - minRow + 1} / span ${d.h ?? 1}`,
                }}
              >
                {d.id}
                {!isMine && (
                  <span
                    className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ring-2 ring-background ${STATUS_DOT[d.status]}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
