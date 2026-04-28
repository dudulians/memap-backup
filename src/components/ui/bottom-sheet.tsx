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
          // vaul reads pointer events from the whole content, but a
          // visible pill makes the affordance obvious. Stays
          // tappable to close as a bonus.
          <DrawerPrimitive.Handle className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-muted-foreground/30 flex-shrink-0" />
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
