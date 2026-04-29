/**
 * BottomSheet — vaul-based bottom sheet for the whole app.
 *
 * Replaces our previous Radix Sheet (side="bottom") for one reason:
 * vaul handles the awkward dance between native scroll and
 * drag-to-dismiss correctly out of the box. With our hand-rolled
 * pointer-event handlers, dragging the sheet down after the user
 * had scrolled the content was unreliable on iOS WebView — the
 * native scroll would "win" the gesture and our drag would never
 * claim. vaul listens to scroll events directly and only allows
 * dismiss-drag once scrollTop is back at 0, which is the iOS-native
 * behaviour.
 *
 * API mirrors the old SheetContent so migration is mostly mechanical:
 *   <BottomSheet open={...} onOpenChange={...} className="h-[80vh]">
 *     {body}
 *   </BottomSheet>
 *
 * Defaults that match the rest of the app:
 *   - 92vh max height (so a tiny strip of the underlying screen is
 *     dimmed and visible — same look as our previous bottom sheet)
 *   - rounded-t-3xl corners
 *   - drag handle pill at top (the "polosa" the user expects)
 *   - X close button top-right
 *   - tap on backdrop closes
 *   - swipe-down on handle OR on body content closes (vaul handles
 *     scroll-vs-drag coordination)
 */
import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Override height (default max-h-[92vh]). Pass e.g. "h-[80vh]". */
  className?: string;
  /** Hide the X button top-right. Use when the body has its own close UX. */
  hideClose?: boolean;
  /** Hide the drag handle pill. Rare — only if the body provides one. */
  hideHandle?: boolean;
  /**
   * Apple-Music / iOS-modal "card on top of app" effect: vaul scales
   * the background page slightly down so the sheet visibly sits on a
   * darker, smaller version of the app underneath. Reads as a layered
   * presentation rather than a generic bottom panel — use for sheets
   * that take ~95vh and feel like a primary mode (Play). Default off
   * because confetti & other fixed overlays in the body sometimes
   * fight with the scale transform.
   */
  scaleBackground?: boolean;
  /**
   * Accessibility label for the sheet — required by Radix/vaul. If
   * the body has its own visible heading, pass that as the title.
   */
  ariaTitle?: string;
}

export const BottomSheet = ({
  open,
  onOpenChange,
  children,
  className,
  hideClose = false,
  hideHandle = false,
  scaleBackground = false,
  ariaTitle,
}: BottomSheetProps) => (
  <DrawerPrimitive.Root
    open={open}
    onOpenChange={onOpenChange}
    // Per-sheet opt-in. Off by default to avoid the scale transform
    // fighting with confetti / fixed overlays during e.g. the Done
    // screen — but Play (the primary mode) opts IN so the sheet sits
    // visibly on top of a darkened, slightly-smaller app, like Apple
    // Music's Now Playing.
    shouldScaleBackground={scaleBackground}
    // Lower close threshold (vaul default 0.25 = 25% of sheet height
    // → ~210 px on a 92vh sheet, way too much pull). 0.1 = ~85 px is
    // a comfortable "decisive but not accidental" pull. Combined with
    // the bigger handle hit-area below, this is what the user
    // expected when she said "I scroll down then it's hard to close".
    closeThreshold={0.1}
    // No scroll-lock cooldown after the body's scroll ends. Default
    // 100 ms makes drag-to-close feel "stuck" if you just finished
    // scrolling and immediately try to pull down — vaul ignores the
    // first ~100 ms of pull, the user reads it as "the gesture isn't
    // working / it's bouncing me back". 0 ms means scroll → pull
    // transitions instantly to drag-close.
    scrollLockTimeout={0}
  >
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background shadow-2xl outline-none",
          // Default cap. Consumer can override with `className` since
          // tailwind-merge resolves height conflicts in cn().
          "max-h-[92vh]",
          className,
        )}
      >
        {!hideHandle && (
          // Generous drag affordance — vaul reads pointer events from
          // the whole content, but when the body has scrolled (e.g.
          // long form in TrackerSettingsModal) drag-from-body is
          // blocked by vaul's scroll-detection (iOS-native behaviour).
          // A bigger, more obvious handle gives the user a reliable
          // place to grab and drag down to close, regardless of how
          // far the body is scrolled. The wrapper provides a tall
          // hit area (`py-3` = 24 px touch target around the pill),
          // the inner pill is wider/visible (h-1.5 w-14, deeper grey
          // so it reads against the cream background).
          <div className="flex-shrink-0 flex justify-center py-3 cursor-grab active:cursor-grabbing">
            <DrawerPrimitive.Handle className="h-1.5 w-14 rounded-full bg-muted-foreground/40" />
          </div>
        )}
        {/* Hidden title for screen readers / a11y. vaul (and Radix
            Dialog underneath) want a labelable element. */}
        {ariaTitle && (
          <DrawerPrimitive.Title className="sr-only">
            {ariaTitle}
          </DrawerPrimitive.Title>
        )}
        {!hideClose && (
          <DrawerPrimitive.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 h-9 w-9 rounded-full bg-muted/40 hover:bg-muted flex items-center justify-center text-foreground z-10"
            >
              <X className="h-5 w-5" />
            </button>
          </DrawerPrimitive.Close>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  </DrawerPrimitive.Root>
);

// Re-export some primitives in case a callsite needs more direct access
// (e.g. a programmatic close button inside the body).
export const BottomSheetClose = DrawerPrimitive.Close;
