// "Something worrying?" (research round 2, Nov 7 2026): signs that are never counted toward
// a rule or a link — they mean a doctor tonight, today, or soon. Calm words, the right
// number for where she is. Sources: marketing/research/body-proposed-additions.md "Red flags".
import { useTranslation } from "react-i18next";
import { Phone } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { supportLines } from "@/lib/supportLines";

/** The emergency number where the phone is, by its time zone (no location asked). */
const numbers = (): { emergency: string; urgent?: string } => { const s = supportLines(); return { emergency: s.emergency, urgent: s.urgent }; };

const Group = ({ title, items, tone }: { title: string; items: string[]; tone: "now" | "today" | "soon" }) => (
  <div className="surface mt-3 shrink-0 rounded-[20px] px-4 py-3.5">
    <p className={`text-[17px] font-bold ${tone === "now" ? "text-[hsl(var(--strong))]" : ""}`}>{title}</p>
    <ul className="mt-1.5 space-y-1.5">
      {items.map((x) => <li key={x} className="flex gap-2 text-[15px] font-semibold leading-snug"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />{x}</li>)}
    </ul>
  </div>
);

export const RedFlagsSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const n = numbers();
  const list = (k: string) => t(`redFlags.${k}`, { returnObjects: true }) as unknown as string[];
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={t("redFlags.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
        <h2 className="pt-1 text-[24px] font-bold leading-tight">{t("redFlags.title")}</h2>
        <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{t("redFlags.line")}</p>
        <a href={`tel:${n.emergency.split(" ")[0]}`} className="raised-btn mt-4 flex h-[52px] w-full items-center justify-center gap-2">
          <Phone className="h-5 w-5" strokeWidth={2.6} />{t("redFlags.call", { n: n.emergency })}
        </a>
        <Group tone="now" title={t("redFlags.nowTitle", { n: n.emergency })} items={list("now")} />
        <Group tone="today" title={n.urgent ? t("redFlags.todayTitleN", { n: n.urgent }) : t("redFlags.todayTitle")} items={list("today")} />
        <Group tone="soon" title={t("redFlags.soonTitle")} items={list("soon")} />
        <p className="mt-4 text-[13px] font-semibold text-muted-foreground">{t("redFlags.source")}</p>
      </div>
    </BottomSheet>
  );
};
