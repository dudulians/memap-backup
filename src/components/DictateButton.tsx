// Speak a note (Aurora, her ask: "голосом записывать, но не AI, а просто
// диктовать в текст"). Since Nov 2 2026 ("я жму жму, а потом читаю, что
// нажми у себя на клавиатуре — так не должно быть"): one big mic button.
// The first tap asks for the microphone, then words appear in the note as
// she speaks; tap again to stop. No hint about the keyboard's mic.
// Plain dictation, no AI: src/lib/speech.ts.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { canDictate, listen, type Take } from "@/lib/speech";

export const DictateButton = ({ text, onText }: { text: string; onText: (next: string) => void }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "starting" | "listening" | "denied" | "unavailable">("idle");
  const take = useRef<Take | null>(null);
  // What was written before this take; the take's words go after it.
  const base = useRef("");
  useEffect(() => () => take.current?.stop(), []);

  if (!canDictate()) return null;

  const start = async () => {
    haptics.tap();
    base.current = text.trimEnd();
    setState("starting");
    const { result, take: running } = await listen(
      (words) => onText(base.current ? `${base.current} ${words}` : words),
      () => { take.current = null; setState((s) => (s === "listening" || s === "starting" ? "idle" : s)); },
    );
    if (result !== "listening" || !running) {
      setState(result === "denied" ? "denied" : "unavailable");
      return;
    }
    take.current = running;
    setState("listening");
  };
  const stop = () => {
    haptics.tap();
    take.current?.stop();
    take.current = null;
    setState("idle");
  };
  const on = state === "listening" || state === "starting";

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={on ? stop : start} aria-pressed={on}
        aria-label={on ? t("notesTab.dictateStop") : t("notesTab.dictate")}
        className={cn("relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
          on ? "bg-[hsl(var(--coin-teal))] text-white" : "bg-foreground/[0.06] text-[hsl(var(--coin-teal))]")}>
        {on && <span aria-hidden="true" className="dictate-pulse absolute inset-0 rounded-full" />}
        <Mic className="relative h-6 w-6" strokeWidth={2.2} />
      </button>
      <span className="text-[16px] font-semibold text-foreground/80">
        {state === "listening" ? t("notesTab.listening")
          : state === "starting" ? t("notesTab.dictate")
          : state === "denied" ? t("notesTab.micDenied")
          : state === "unavailable" ? t("notesTab.micUnavailable")
          : t("notesTab.dictate")}
      </span>
    </div>
  );
};
