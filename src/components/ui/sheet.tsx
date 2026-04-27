import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Hide the drag-handle pill that normally shows on bottom sheets. */
  hideDragHandle?: boolean;
}

/**
 * When `side="bottom"`, the sheet gets:
 *   - a drag-handle pill at the top (visual affordance for swipe-down)
 *   - swipe-down-to-close from ANYWHERE on the body, iOS-style:
 *       • below 10px of vertical movement → tap (button onClick fires)
 *       • past 10px → take over as drag, suppress the upcoming click
 *       • past 180px on release → animate out and close
 *       • below 180px → snap back, also suppress the click
 *   - if the body has been scrolled, drag yields to scroll until the
 *     user reaches scrollTop=0, mirroring iOS bottom-sheet behaviour.
 * The handle proxies close by clicking the hidden SheetPrimitive.Close,
 * which lets Radix handle animations and restores focus correctly.
 */
const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, hideDragHandle, ...props }, ref) => {
    const isBottom = side === "bottom";
    // We deliberately do NOT keep dragY in React state. State updates
    // on every pointermove cause re-renders at finger-speed, and React
    // reconciliation on iOS WebView is just slow enough to drop frames
    // — that's the "shake/jitter" users see. Instead we mutate the DOM
    // directly via ref during drag, and only flip a `releasing` flag
    // (which IS state) once when the user lifts their finger.
    const dragYRef = React.useRef(0);
    const rafRef = React.useRef<number | null>(null);
    const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
    const releaseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    // Local ref to the SheetPrimitive.Content node so we can:
    //   – check its scrollTop (overflow-y-auto comes from consumers)
    //   – mutate its inline transform directly during drag
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );
    const dragStart = React.useRef<number | null>(null);
    const activePointer = React.useRef<number | null>(null);
    // iOS-style tap/drag disambiguation refs
    const isDraggingRef = React.useRef(false);
    const wasDraggingRef = React.useRef(false);
    // The Y at which the content reached scrollTop=0 during the
    // current gesture. Re-set to null whenever we observe scroll
    // movement above zero. Drag-to-dismiss kicks in once this is
    // populated AND the finger has travelled DRAG_START_PX downward
    // from it. That replicates iOS's "scroll first, dismiss when you
    // hit the top" behaviour.
    const topAnchorY = React.useRef<number | null>(null);
    // scrollTop at the moment the pointer landed. If it never changes
    // during the gesture we know the user isn't scrolling — typically
    // a desktop mouse drag, where the browser doesn't auto-scroll on
    // pointer-drag — and we still want them to be able to dismiss.
    const startScrollTop = React.useRef(0);

    const DRAG_START_PX = 10;
    const DISMISS_PX = 180;

    // Apply the live drag transform directly to the content element.
    // translate3d forces a GPU-composited layer on iOS so the move is
    // smooth instead of repainting layout each frame.
    const applyTransform = (dy: number) => {
      const el = contentRef.current;
      if (!el) return;
      if (dy > 0) {
        el.style.transform = `translate3d(0, ${dy}px, 0)`;
        el.style.transition = "none";
      } else {
        el.style.transform = "";
        el.style.transition = "";
      }
    };

    // Animate back to 0 (or off-screen for dismiss) using a CSS
    // transition. We can't just set transform="" — that would jump.
    // We need the transition + a target value.
    const animateToTarget = (targetY: number) => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transition = "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)";
      el.style.transform = `translate3d(0, ${targetY}px, 0)`;
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        el.style.transition = "";
        if (targetY === 0) el.style.transform = "";
      }, 300);
    };

    // Drag handle (small pill at the top) — direct grab+drag.
    const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      activePointer.current = e.pointerId;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
      dragStart.current = e.clientY;
      isDraggingRef.current = true;
    };

    // Body — pointer events on the entire sheet content. Buttons inside
    // still receive tap clicks because we wait for movement past
    // DRAG_START_PX before calling setPointerCapture.
    const onBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== null) return;
      activePointer.current = e.pointerId;
      dragStart.current = e.clientY;
      isDraggingRef.current = false;
      const el = contentRef.current;
      const atTop = !el || el.scrollTop <= 0;
      topAnchorY.current = atTop ? e.clientY : null;
      startScrollTop.current = el?.scrollTop ?? 0;
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== e.pointerId || dragStart.current === null) return;
      const el = contentRef.current;
      const currentScrollTop = el?.scrollTop ?? 0;
      const atTop = currentScrollTop <= 0;

      if (!isDraggingRef.current) {
        const dyFromStart = e.clientY - dragStart.current;
        // Path A — the iOS-style "scroll first, then dismiss". Native
        // scroll brings the content up to scrollTop=0; once that
        // happens we plant an anchor and require an extra
        // DRAG_START_PX downward movement before claiming drag.
        if (atTop) {
          if (topAnchorY.current === null) {
            topAnchorY.current = e.clientY;
            return;
          }
          if (e.clientY - topAnchorY.current > DRAG_START_PX) {
            isDraggingRef.current = true;
            dragStart.current = topAnchorY.current;
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
          } else {
            return;
          }
        }
        // Path B — desktop mouse-drag. The cursor doesn't scroll the
        // sheet by default, so scrollTop sits unchanged at startScrollTop
        // while the user pulls down with a deliberate drag. Allow the
        // dismiss after a generous 50px so accidental nudges don't
        // close the sheet, but we don't strand the user on a sheet
        // they scrolled into.
        else if (
          currentScrollTop === startScrollTop.current &&
          dyFromStart > 50
        ) {
          isDraggingRef.current = true;
          // dragStart stays at original pointer-down Y so the visible
          // travel matches the user's finger from the start of the
          // intentional drag.
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        }
        // Path C — content actively scrolling. Reset the top-anchor
        // so we re-arm only after scroll settles back at zero.
        else {
          topAnchorY.current = null;
          return;
        }
      }

      const dy = e.clientY - dragStart.current;
      const next = Math.max(0, dy);
      dragYRef.current = next;
      // Coalesce updates to one per animation frame to avoid stacking
      // up re-flows when pointermove fires faster than 60Hz on iOS.
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          applyTransform(dragYRef.current);
        });
      }
    };

    const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== e.pointerId) return;
      const wasDrag = isDraggingRef.current;
      const finalDy = dragYRef.current;
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      activePointer.current = null;
      dragStart.current = null;
      isDraggingRef.current = false;
      topAnchorY.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      dragYRef.current = 0;

      if (wasDrag) {
        wasDraggingRef.current = true;
        setTimeout(() => { wasDraggingRef.current = false; }, 50);
        if (finalDy > DISMISS_PX) {
          // Slide the sheet down off-screen, then trigger Radix close.
          const el = contentRef.current;
          const distance = el ? el.getBoundingClientRect().height : 800;
          animateToTarget(distance);
          setTimeout(() => closeBtnRef.current?.click(), 200);
        } else {
          animateToTarget(0);
        }
      }
    };

    // Capture-phase click — if the pointer just finished a drag,
    // swallow the click that would otherwise fire on the underlying
    // button. Without this, "drag down + release on a row" would
    // both dismiss the sheet AND trigger the row's onClick.
    const onBodyClickCapture = (e: React.MouseEvent) => {
      if (wasDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={setRefs}
          className={cn(sheetVariants({ side }), isBottom && !hideDragHandle && "pt-8", className)}
          // Live transform is mutated directly via the ref in
          // applyTransform/animateToTarget — no React re-renders during
          // drag. willChange hints the browser to keep this on its
          // own GPU layer so movement is smooth on iOS.
          style={isBottom ? { willChange: "transform" } : undefined}
          {...props}
        >
          {isBottom && !hideDragHandle && (
            <div
              onPointerDown={onHandlePointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              className="absolute inset-x-0 top-0 flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none select-none z-10"
              aria-label="Drag down to close"
            >
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          {/* Body wrapper for the iOS-style drag-anywhere dismiss. The
              wrapper takes pointer events for the entire sheet contents
              and proxies them to the dismiss logic above. */}
          {isBottom ? (
            <div
              onPointerDown={onBodyPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClickCapture={onBodyClickCapture}
              className="contents"
            >
              {children}
            </div>
          ) : (
            children
          )}
          <SheetPrimitive.Close
            ref={closeBtnRef}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
