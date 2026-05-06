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
  const maxCol = desks.reduce((m, d) => Math.max(m, d.col + (d.w ?? 1) - 1), 6);
  const maxRow = desks.reduce((m, d) => Math.max(m, d.row + (d.h ?? 1) - 1), 1);

  return (
    <div className="w-full flex justify-center py-2">
      <div className="w-full max-w-[640px] bg-card border border-border rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background grid texture */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px'
          }}
        />
        
        <div
          className="relative grid w-full gap-2 sm:gap-3"
          style={{
            aspectRatio: `${maxCol} / ${maxRow * 1.1}`,
            gridTemplateColumns: `repeat(${maxCol}, 1fr)`,
            gridTemplateRows: `repeat(${maxRow}, 1fr)`,
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
                  relative rounded-xl border transition-all duration-300
                  flex items-center justify-center text-xs sm:text-sm font-bold
                  active:scale-95 hover:scale-[1.02]
                  ${isMine 
                    ? "bg-success border-success text-success-foreground shadow-[0_0_20px_hsl(var(--success)/0.3)]" 
                    : d.status === "occupied"
                      ? "bg-destructive/10 border-destructive/20 text-foreground/30"
                      : "bg-background border-border text-foreground hover:border-foreground/30 hover:bg-secondary"
                  }
                `}
                style={{
                  gridColumn: `${d.col} / span ${d.w ?? 1}`,
                  gridRow: `${d.row} / span ${d.h ?? 1}`,
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
