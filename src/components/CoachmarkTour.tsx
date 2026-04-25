import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const COACHMARK_SEEN_KEY = "memap_coachmark_seen";

/**
 * One step of the coachmark tour. Highlights a real UI element on the
 * page and shows a small bubble explaining what it does.
 *
 *  - `targetSelector` is a CSS selector for the element to highlight.
 *    If multiple match, the first visible one wins.
 *  - `titleKey`/`bodyKey` are i18n keys.
 *  - `placement` controls where the bubble sits relative to the target.
 *  - `padding` is extra px around the spotlight rectangle.
 *  - `shape` — "rect" follows the element bounds, "circle" forces a
 *    circular spotlight (good for round icons / FABs).
 *  - `requireTab` (optional): if set, the host should switch to that
 *    tab before this step runs (Cards / Patterns) so the target exists.
 */
export interface CoachmarkStep {
  id: string;
  targetSelector: string;
  titleKey: string;
  bodyKey: string;
  placement?: "top" | "bottom";
  padding?: number;
  shape?: "rect" | "circle";
  requireTab?: "cards" | "patterns";
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface CoachmarkTourProps {
  open: boolean;
  steps: CoachmarkStep[];
  onClose: () => void;
  /**
   * Called when a step needs a specific tab active. The host (Index)
   * should switch to that tab — the tour will re-measure once the
   * target appears in the DOM.
   */
  onRequestTab?: (tab: "cards" | "patterns") => void;
}

/**
 * Locate a target element. Returns null if not in the DOM yet (host
 * may still be switching tabs / mounting things).
 */
const findTarget = (selector: string): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  const els = document.querySelectorAll<HTMLElement>(selector);
  for (const el of Array.from(els)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
};

const measure = (el: HTMLElement, padding: number): Rect => {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - padding,
    left: r.left - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
};

export const CoachmarkTour = ({ open, steps, onClose, onRequestTab }: CoachmarkTourProps) => {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMissing, setIsMissing] = useState(false);

  const step = steps[stepIndex];

  // Reset when the tour opens fresh
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Ask host to switch tabs if the current step needs it.
  useEffect(() => {
    if (!open || !step?.requireTab) return;
    onRequestTab?.(step.requireTab);
  }, [open, step?.requireTab, onRequestTab]);

  // Locate the target for the current step. Retry a few times so we
  // catch the case where the host is mid-tab-switch and the element
  // hasn't mounted yet.
  const locate = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.targetSelector);
    if (el) {
      setRect(measure(el, step.padding ?? 8));
      setIsMissing(false);
    } else {
      setIsMissing(true);
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    locate();
    let attempts = 0;
    const interval = setInterval(() => {
      const el = findTarget(step.targetSelector);
      if (el) {
        setRect(measure(el, step.padding ?? 8));
        setIsMissing(false);
        clearInterval(interval);
      } else {
        attempts += 1;
        if (attempts > 12) {
          // ~600ms of retries — give up, the host can't surface this
          // target. Skip the step rather than block the tour.
          clearInterval(interval);
          if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
          else handleFinish();
        }
      }
    }, 50);
    return () => clearInterval(interval);
    // We re-run on open / step change; the inner refs read fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, step?.targetSelector]);

  // Re-measure on resize / scroll so the spotlight tracks the element
  useEffect(() => {
    if (!open) return;
    const onChange = () => locate();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, locate]);

  const handleFinish = useCallback(() => {
    try {
      localStorage.setItem(COACHMARK_SEEN_KEY, "true");
    } catch { /* ignore */ }
    onClose();
  }, [onClose]);

  if (!open || !step) return null;

  // Bubble position: above or below the target rect. If we don't have a
  // rect yet, center the bubble on screen.
  const placement = step.placement ?? (rect && rect.top > window.innerHeight / 2 ? "top" : "bottom");
  const bubbleTop = rect
    ? placement === "top"
      ? rect.top - 8
      : rect.top + rect.height + 8
    : window.innerHeight / 2;
  const bubbleTransform = rect
    ? placement === "top"
      ? "translate(-50%, -100%)"
      : "translate(-50%, 0)"
    : "translate(-50%, -50%)";
  const bubbleLeft = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;

  // Spotlight shape — circle uses border-radius 9999px, rect uses 16px.
  const spotlightRadius =
    step.shape === "circle" && rect
      ? Math.max(rect.width, rect.height) / 2
      : 16;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      // Tap on the dark backdrop advances; tap on the spotlight target
      // does NOT pass through (we want the user to read first).
      onClick={(e) => {
        // Only advance if click is on the backdrop, not on the bubble.
        const target = e.target as HTMLElement;
        if (target.closest("[data-coachmark-bubble]")) return;
        if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
        else handleFinish();
      }}
    >
      {/* Dark backdrop with a transparent hole over the target. We
          render a fixed-position div that covers the screen and uses
          a giant box-shadow on the spotlight to fake the "darkened
          everywhere except here" effect. */}
      {rect && !isMissing && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: spotlightRadius,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            transition: "all 0.25s ease",
          }}
        />
      )}
      {/* Pulsing ring around the spotlight to draw the eye */}
      {rect && !isMissing && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: spotlightRadius,
            boxShadow: "0 0 0 4px rgba(255,255,255,0.6), 0 0 0 8px rgba(255,255,255,0.25)",
            animation: "coachmarkPulse 1.6s ease-out infinite",
          }}
        />
      )}

      {/* Fallback dark overlay when the target hasn't been measured yet */}
      {(!rect || isMissing) && (
        <div className="absolute inset-0 bg-black/55" />
      )}

      {/* Bubble */}
      <div
        data-coachmark-bubble
        className={cn(
          "absolute max-w-[300px] w-[88vw] rounded-2xl bg-background shadow-xl border border-border p-4 animate-fade-in"
        )}
        style={{
          top: bubbleTop,
          left: bubbleLeft,
          transform: bubbleTransform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-sm leading-snug">
            {t(step.titleKey)}
          </h3>
          <button
            onClick={handleFinish}
            aria-label={t("common.close")}
            className="text-muted-foreground hover:text-foreground -m-1 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {t(step.bodyKey)}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {stepIndex + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFinish}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {t("coachmark.skip")}
            </button>
            <button
              onClick={() => {
                if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
                else handleFinish();
              }}
              className="rounded-full bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 hover:bg-primary/90 transition-colors"
            >
              {stepIndex < steps.length - 1 ? t("coachmark.next") : t("coachmark.done")}
            </button>
          </div>
        </div>
      </div>

      {/* Pulse keyframes — inlined so this component is self-contained */}
      <style>{`
        @keyframes coachmarkPulse {
          0%   { box-shadow: 0 0 0 4px rgba(255,255,255,0.6),  0 0 0  8px rgba(255,255,255,0.25); }
          70%  { box-shadow: 0 0 0 4px rgba(255,255,255,0.6),  0 0 0 24px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 4px rgba(255,255,255,0.6),  0 0 0  8px rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
};

export const shouldShowCoachmark = (): boolean => {
  try {
    return localStorage.getItem(COACHMARK_SEEN_KEY) !== "true";
  } catch {
    return false;
  }
};

export const resetCoachmarkSeen = (): void => {
  try {
    localStorage.removeItem(COACHMARK_SEEN_KEY);
  } catch { /* ignore */ }
};
