// A raised button that presses in like Duolingo's (Aurora UX step 2, her
// ask: "кружочки должны отжиматься ... с приятной вибрацией"). Face, lip and
// ground are separate spans, so pressing animates transform only. Styles:
// .press3d in index.css. Every press gives a light tap, or `haptic` instead.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

export type PressTone = "teal" | "slate" | "gold" | "sky" | "lilac";

interface PressableProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: PressTone;
  /** "coin" is round; "slab" takes its radius from className. */
  shape?: "coin" | "slab";
  haptic?: "tap" | "medium" | "none";
  faceClassName?: string;
  /** Drawn outside the face (rings, halos), so they don't sink. */
  behind?: ReactNode;
}

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  ({ tone = "teal", shape = "slab", haptic = "tap", className, faceClassName, behind, children, onClick, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn("press3d", `tone-${tone}`, shape === "coin" && "rounded-full", className)}
      onClick={(e) => {
        if (haptic !== "none") haptics[haptic]();
        onClick?.(e);
      }}
      {...rest}
    >
      {behind}
      <span aria-hidden="true" className="press3d-ground" />
      <span aria-hidden="true" className="press3d-lip" />
      <span className={cn("press3d-face", faceClassName)}>{children}</span>
    </button>
  ),
);
Pressable.displayName = "Pressable";
