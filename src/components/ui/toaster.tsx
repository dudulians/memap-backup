import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();
  // Mobile: viewport is top, swipe up to dismiss. Desktop: viewport is bottom-right, swipe right.
  const [swipeDirection, setSwipeDirection] = useState<"up" | "right">(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches ? "right" : "up"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 640px)");
    const update = () => setSwipeDirection(mql.matches ? "right" : "up");
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return (
    <ToastProvider swipeDirection={swipeDirection} swipeThreshold={40}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
