// Speak a note (Aurora, her ask: "голосом записывать, но не AI, а просто
// диктовать и в текст"). Plain dictation, no AI. Where the web view can
// listen (SpeechRecognition), words are typed into the note as she speaks.
// Where it can't (the iPhone app's web view), the button opens the keyboard
// and says where the keyboard's own microphone is: that is the same plain
// dictation, on the device. A native plugin can replace this later.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getLanguage } from "@/lib/i18n";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const make = (): Recognition | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return R ? new R() : null;
};

export const DictateButton = ({ onText, target }: { onText: (more: string) => void; target: () => HTMLTextAreaElement | null }) => {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => () => rec.current?.stop(), []);

  const start = () => {
    haptics.tap();
    const r = make();
    if (!r) {
      // No listening here: open the keyboard, its microphone dictates.
      target()?.focus();
      setHint(true);
      return;
    }
    r.lang = getLanguage() === "ru" ? "ru-RU" : "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      if (said.trim()) onText(said.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); target()?.focus(); setHint(true); };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      target()?.focus();
      setHint(true);
    }
  };
  const stop = () => {
    haptics.tap();
    rec.current?.stop();
    setListening(false);
  };

  return (
    <div>
      <button type="button" onClick={listening ? stop : start} aria-pressed={listening}
        className={cn("surface inline-flex h-11 items-center gap-2 rounded-full pl-3 pr-4 text-[15px] font-semibold",
          listening && "ring-2 ring-[hsl(var(--coin-teal))]")}>
        {listening ? <Square className="h-4 w-4 fill-current text-[hsl(var(--coin-teal))]" /> : <Mic className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />}
        {listening ? t("notesTab.dictateStop") : t("notesTab.dictate")}
      </button>
      {hint && <p className="mt-2 text-[15px] font-medium text-muted-foreground">{t("notesTab.dictateHint")}</p>}
    </div>
  );
};
