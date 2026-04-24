import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerFieldProps {
  value: string; // 24h HH:MM
  onChange: (value: string) => void;
}

function parse24h(value: string): { hour: number; minute: number; period: "AM" | "PM" } {
  const [h, m] = value.split(":").map(Number);
  const safeH = isNaN(h) ? 20 : h;
  const safeM = isNaN(m) ? 0 : m;
  const period = safeH < 12 ? "AM" : "PM";
  const hour = safeH % 12 === 0 ? 12 : safeH % 12;
  const minute = Math.round(safeM / 5) * 5 >= 60 ? 55 : Math.round(safeM / 5) * 5;
  return { hour, minute, period };
}

function to24h(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplay(value: string): string {
  const { hour, minute, period } = parse24h(value);
  return `${hour}:${String(minute).padStart(2, "0")} ${period}`;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const TimePickerField = ({ value, onChange }: TimePickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parse24h(value));

  const handleOpen = (next: boolean) => {
    if (next) setDraft(parse24h(value));
    setOpen(next);
  };

  const handleSet = () => {
    onChange(to24h(draft.hour, draft.minute, draft.period));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-xl border bg-muted/40",
            "text-sm font-medium text-foreground hover:bg-muted/70 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span>{formatDisplay(value)}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-4 rounded-2xl shadow-lg border bg-background"
        align="start"
        sideOffset={6}
      >
        <p className="text-xs font-medium text-muted-foreground mb-3 text-center tracking-wide uppercase">
          Set reminder time
        </p>

        <div className="flex gap-3">
          {/* Hour column */}
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground text-center mb-1.5">Hour</p>
            <div className="grid grid-cols-3 gap-1">
              {HOURS.map(h => (
                <button
                  key={h}
                  onClick={() => setDraft(d => ({ ...d, hour: h }))}
                  className={cn(
                    "py-1.5 rounded-lg text-sm font-medium transition-colors",
                    draft.hour === h
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minute column */}
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground text-center mb-1.5">Min</p>
            <div className="grid grid-cols-3 gap-1">
              {MINUTES.map(m => (
                <button
                  key={m}
                  onClick={() => setDraft(d => ({ ...d, minute: m }))}
                  className={cn(
                    "py-1.5 rounded-lg text-sm font-medium transition-colors",
                    draft.minute === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* AM / PM column */}
          <div className="w-14">
            <p className="text-[10px] text-muted-foreground text-center mb-1.5">Period</p>
            <div className="flex flex-col gap-1">
              {(["AM", "PM"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setDraft(d => ({ ...d, period: p }))}
                  className={cn(
                    "py-1.5 rounded-lg text-sm font-medium transition-colors",
                    draft.period === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          className="w-full mt-4 rounded-xl"
          onClick={handleSet}
        >
          Set time
        </Button>
      </PopoverContent>
    </Popover>
  );
};
