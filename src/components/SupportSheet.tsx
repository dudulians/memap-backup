// "Talk to someone" (safety round, Nov 7 2026): a free line for where the phone is, the
// emergency number for "not safe right now", and a report to show a doctor or therapist.
// Opened from mood question cards ("Need to talk?") and from the two-weeks card on Today.
import { useTranslation } from "react-i18next";
import { ExternalLink, FileText, Phone } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { supportLines } from "@/lib/supportLines";

export const SupportSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const n = supportLines();
  const ru = i18n.language?.startsWith("ru");
  const report = () => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent("memap-doctor-report")), 320); };
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[80vh]" ariaTitle={t("support.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
        <h2 className="pt-1 text-[24px] font-bold leading-tight">{t("support.title")}</h2>
        <p className="mt-1 text-[16px] font-semibold text-muted-foreground">{t("support.line")}</p>

        {n.talk ? (
          <a href={`tel:${n.talk.tel}`} className="raised-btn mt-4 flex h-[52px] w-full items-center justify-center gap-2">
            <Phone className="h-5 w-5" strokeWidth={2.6} />{t("support.callLine", { n: n.talk.number })}
          </a>
        ) : (
          <a href={n.web} target="_blank" rel="noreferrer" className="raised-btn mt-4 flex h-[52px] w-full items-center justify-center gap-2">
            <ExternalLink className="h-5 w-5" strokeWidth={2.6} />{t("support.findLine")}
          </a>
        )}
        {n.talk && <p className="mt-2 text-center text-[14px] font-semibold text-muted-foreground">{ru ? n.talk.nameRu : n.talk.name}</p>}

        <div className="surface mt-4 shrink-0 rounded-[20px] px-4 py-3.5">
          <p className="text-[17px] font-bold text-[hsl(var(--strong))]">{t("support.dangerTitle")}</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug">{t("support.dangerLine", { n: n.emergency })}</p>
          <a href={`tel:${n.emergency.split(" ")[0]}`} className="surface mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold">
            <Phone className="h-4 w-4" strokeWidth={2.6} />{t("redFlags.call", { n: n.emergency })}
          </a>
        </div>

        <div className="surface mt-3 shrink-0 rounded-[20px] px-4 py-3.5">
          <p className="text-[17px] font-bold">{t("support.doctorTitle")}</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug">{t("support.doctorLine")}</p>
          <button type="button" onClick={report} className="surface mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold">
            <FileText className="h-4 w-4" strokeWidth={2.6} />{t("support.report")}
          </button>
        </div>

        <p className="mt-4 text-[13px] font-semibold text-muted-foreground">{t("support.source")}</p>
      </div>
    </BottomSheet>
  );
};
