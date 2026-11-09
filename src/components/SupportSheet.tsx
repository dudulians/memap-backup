// "Talk to someone" (safety round, Nov 7 2026): a free helpline, "your local emergency number" for "not safe
// right now", and a report to show a doctor or therapist. Opened from mood question cards ("Need to talk?"),
// the two-weeks card on Today and the two partner cards in When to act.
// From a partner shouting or saying hurtful things (persona walk, Nov 9 2026: the sheet asked "Hard most days?"
// like a low-mood card, with no line for being afraid at home): its own words, that it isn't their fault, and
// free lines for when someone is afraid at home.
// No phone numbers typed into MeMap (her note, Nov 9 2026): links to directories the helplines keep up to date
// (supportLines.ts says which and why).
import { useTranslation } from "react-i18next";
import { ExternalLink, FileText } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HOME_HARM_IDS, helpLinks, talkNoteKey } from "@/lib/supportLines";

export const SupportSheet = ({ open, onClose, about }: { open: boolean; onClose: () => void; about?: string | null }) => {
  const { t, i18n } = useTranslation();
  const links = helpLinks(i18n.language);
  const home = !!about && HOME_HARM_IDS.has(about);
  const note = talkNoteKey();
  const report = () => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent("memap-doctor-report")), 320); };
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[80vh]" ariaTitle={t("support.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
        <h2 className="pt-1 text-[24px] font-bold leading-tight">{t("support.title")}</h2>
        <p className="mt-1 text-[16px] font-semibold text-muted-foreground">{t(home ? "support.homeLine" : "support.line")}</p>

        {home ? (
          <div className="surface mt-4 shrink-0 rounded-[20px] px-4 py-3.5">
            <p className="text-[17px] font-bold">{t("support.homeTitle")}</p>
            <p className="mt-1 text-[15px] font-semibold leading-snug">{t("support.homeFind")}</p>
            <a href={links.safe} target="_blank" rel="noreferrer" className="raised-btn mt-3 flex h-[52px] w-full items-center justify-center gap-2">
              <ExternalLink className="h-5 w-5" strokeWidth={2.6} />{t("support.findHome")}
            </a>
            {/* a partner may look at the phone (NNEDV Safety Net; the Hotline: call when your partner isn't around) */}
            <p className="mt-2.5 text-[14px] font-semibold leading-snug text-muted-foreground">{t("support.homePrivate")}</p>
          </div>
        ) : null}
        {/* someone to talk to, in words, on both versions: no directory link (Nov 9 2026) */}
        <div className={(home ? "mt-3" : "mt-4") + " surface shrink-0 rounded-[20px] px-4 py-3.5"}>
          {/* the afraid-at-home card above already says a helpline can help: here only the people close by */}
          {!home && <p className="mb-1.5 text-[15px] font-semibold leading-snug">{t(note ?? "support.findTalk")}</p>}
          <p className={home ? "text-[15px] font-semibold leading-snug" : "text-[14px] font-semibold leading-snug text-muted-foreground"}>{t("support.talkLine")}</p>
        </div>

        <div className="surface mt-4 shrink-0 rounded-[20px] px-4 py-3.5">
          <p className="text-[17px] font-bold text-[hsl(var(--strong))]">{t("support.dangerTitle")}</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug">{t("support.dangerLine")}</p>
        </div>

        {!home && (
          <div className="surface mt-3 shrink-0 rounded-[20px] px-4 py-3.5">
            <p className="text-[17px] font-bold">{t("support.doctorTitle")}</p>
            <p className="mt-1 text-[15px] font-semibold leading-snug">{t("support.doctorLine")}</p>
            <button type="button" onClick={report} className="surface mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold">
              <FileText className="h-4 w-4" strokeWidth={2.6} />{t("support.report")}
            </button>
          </div>
        )}

        <p className="mt-4 text-[13px] font-semibold text-muted-foreground">{t(home ? "support.sourceHome" : "support.source")}</p>
      </div>
    </BottomSheet>
  );
};
