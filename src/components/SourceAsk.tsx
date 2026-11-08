// "Where did you hear about MeMap?" (her note, Nov 8 2026: "давай добавим, откуда пришли пользователи"):
// one tap at the end of onboarding, on the "Your world has begun" screen, never required. The answer is
// kept and put on every later analytics event, so each channel's people can be followed.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getSource, setSource } from "@/lib/analytics";

export const SOURCES = ["instagram", "tiktok", "appstore", "friend", "reddit", "other"] as const;

export const SourceAsk = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(getSource);
  return (
    <div className={cn("surface rounded-[20px] px-4 py-3.5", className)}>
      <p className="text-[16px] font-bold leading-snug">{t("source.title")}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SOURCES.map((k) => (
          <button key={k} type="button" aria-pressed={picked === k} disabled={!!picked && picked !== k}
            onClick={() => { if (picked) return; haptics.tap(); setSource(k); setPicked(k); }}
            className={cn("chip h-10 px-3.5 text-[15px] font-bold disabled:opacity-40", picked === k && "pick-on")}>
            {picked === k && <Check className="mr-1 inline h-4 w-4" strokeWidth={3} />}{t(`source.${k}`)}
          </button>
        ))}
      </div>
      {picked && <p className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("source.thanks")}</p>}
    </div>
  );
};
