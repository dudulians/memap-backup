// Small UI marks (back, close, plus, check, chevrons, settings, bell)
// drawn by hand in one round-cap line, so the main screens don't carry
// a stock icon set. They take the text colour.
import { cn } from "@/lib/utils";

export type GlyphKind = "back" | "close" | "plus" | "check" | "right" | "left" | "down" | "gear" | "bell" | "pencil" | "calendar" | "chart" | "up";

const D: Record<GlyphKind, string> = {
  back: "M14.5 5.5c-2.6 2.2-5.2 4.4-7.8 6.6 2.7 2 5.4 4.1 8 6.3M7.2 12.1c4.2-.2 8.4-.1 12.6.2",
  close: "M6.2 6.4c3.9 3.6 7.6 7.5 11.4 11.3M17.7 6.1c-3.9 3.8-7.7 7.8-11.5 11.6",
  plus: "M12.1 5c-.2 4.7-.1 9.4.1 14.1M5 12.2c4.7-.3 9.4-.3 14.1-.1",
  check: "M5.2 12.6c1.7 1.6 3.3 3.3 4.9 5 2.9-3.9 5.9-7.7 9-11.4",
  right: "M9.4 5.6c2.6 2.1 5 4.3 7.2 6.6-2.3 2.1-4.6 4.2-7 6.2",
  left: "M14.6 5.6c-2.6 2.1-5 4.3-7.2 6.6 2.3 2.1 4.6 4.2 7 6.2",
  down: "M5.6 9.4c2.1 2.6 4.3 5 6.6 7.2 2.1-2.3 4.2-4.6 6.2-7",
  gear: "M12 8.6c1.9 0 3.4 1.5 3.4 3.4s-1.5 3.4-3.4 3.4-3.4-1.5-3.4-3.4 1.5-3.4 3.4-3.4zM12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M6.1 17.9l1.6-1.6M16.3 7.7l1.6-1.6",
  bell: "M6.4 16.6c1-1.2 1.2-2.6 1.2-4.4 0-2.8 1.8-5 4.4-5s4.4 2.2 4.4 5c0 1.8.2 3.2 1.2 4.4zM10.2 19.2c.5.8 1.1 1.2 1.8 1.2s1.3-.4 1.8-1.2",
  pencil: "M5.4 18.6l.8-3.6 9.6-9.6c.9-.9 2-.9 2.8 0 .8.8.8 1.9 0 2.8l-9.6 9.6zM14.4 6.8l2.8 2.8",
  calendar: "M5.2 7.4c4.6-.4 9.2-.4 13.8 0 .4 3.9.4 7.9 0 11.8-4.6.4-9.2.4-13.8 0-.4-3.9-.4-7.9 0-11.8zM5.4 11c4.4-.2 8.8-.2 13.2 0M9 4.6v4M15 4.6v4M9.2 14.6l1.6 1.5 3.2-3",
  chart: "M4.8 5.2c-.2 4.6-.2 9.2.2 13.8 4.6.3 9.3.3 14 0M8 15.6c1.3-1.8 2.4-3.6 3.6-5.4 1.2 1.2 2.4 2.4 3.4 3.6 1.4-2.4 2.8-4.6 4.2-6.8",
  up: "M5.6 14.6c2.1-2.6 4.3-5 6.6-7.2 2.1 2.3 4.2 4.6 6.2 7M12.2 7.6c.2 4 .2 8 0 12",
};

export const Glyph = ({
  kind,
  size = 22,
  className,
  strokeWidth = 2.5,
}: {
  kind: GlyphKind;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={cn("shrink-0", className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={D[kind]} />
  </svg>
);
