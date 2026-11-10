// "Worth watching": today's tip, the question it would add, where it comes from, and one button
// that adds the question (Nov 8 2026).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Pressable } from "@/components/ui/pressable";
import { OBSERVE_TIPS } from "@/lib/observeTipsData";
import { markTip } from "@/lib/observeTips";
import { ensureTemplates, findTemplate } from "@/lib/doors";
import { templateQuestion } from "@/lib/cardText";
import { localizeTrackerQuestion } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";
import { track, useScreen } from "@/lib/analytics";

export const ObserveTipSheet = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const [added, setAdded] = useState(false);
  useScreen("tip", !!id);
  const tip = id ? OBSERVE_TIPS.find((x) => x.id === id) ?? null : null;
  const ru = i18n.language?.startsWith("ru");
  const words = tip ? (ru ? tip.ru : tip.en) : null;
  const f = tip ? findTemplate(tip.templateId) : null;
  const question = f ? localizeTrackerQuestion(templateQuestion(f.template)) : "";
  const close = () => { setAdded(false); onClose(); };
  const add = async () => {
    if (!tip) return;
    haptics.success?.();
    await ensureTemplates([tip.templateId]);
    markTip(tip.id, "added");
    track("observe_tip_added", { tip: tip.id });
    setAdded(true);
  };
  const later = () => { if (tip) { markTip(tip.id, "later"); track("observe_tip_later", { tip: tip.id }); } haptics.tap(); close(); };
  return (
    <BottomSheet open={!!tip} onOpenChange={(o) => { if (!o) { if (tip && !added) { markTip(tip.id, "later"); track("observe_tip_later", { tip: tip.id }); } close(); } }} ariaTitle={t("tipDay.step")}>
      {tip && words && (
        <div className="px-5 pb-8 pt-1">
          <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <BookOpen className="h-4 w-4" strokeWidth={2.4} /> {t("tipDay.step")}
          </p>
          <p className="mt-2 text-[24px] font-bold leading-tight tracking-tight">{words.title}</p>
          <p className="mt-2 text-[17px] font-medium leading-snug">{words.line}</p>
          {question && (
            <div className="surface mt-4 rounded-[18px] px-4 py-3">
              <p className="text-[14px] font-semibold text-muted-foreground">{t("tipDay.asks")}</p>
              <p className="mt-0.5 text-[17px] font-bold leading-snug">{question}</p>
            </div>
          )}
          {/* the source as quiet small print, not a link (her note, Nov 10 2026) */}
          <p data-tip-source className="mt-3 text-[12px] font-medium leading-snug text-muted-foreground opacity-60">
            {t("tipDay.source", { name: tip.source.name })}
          </p>
          {added ? (
            <>
              <p className="mt-5 flex items-center gap-2 text-[17px] font-bold"><Check className="h-5 w-5 text-[hsl(var(--balanced))]" strokeWidth={3} /> {t("tipDay.added")}</p>
              <button type="button" onClick={close} className="quiet-btn mt-3 h-12 w-full text-[16px]">{t("common.close")}</button>
            </>
          ) : (
            <>
              <Pressable tone="teal" haptic="none" onClick={add} className="mt-5 h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("tipDay.watch")}
              </Pressable>
              <button type="button" onClick={later} className="mt-1 h-11 w-full text-[15px] font-semibold text-muted-foreground">{t("tipDay.later")}</button>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
