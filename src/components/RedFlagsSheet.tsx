// "Something worrying?" (research round 2, Nov 7 2026): signs that are never counted toward
// a rule or a link — they mean a doctor tonight, today, or soon. Calm words; "your local emergency number" in
// words, no number typed in (her note, Nov 9 2026: a wrong number is worse than none; supportLines.ts).
// Sources: marketing/research/body-proposed-additions.md "Red flags".
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

/** What each sign is about, in the order of the lists in the locales (now / today / soon). */
type Area = "heart" | "gut" | "head" | "bladder" | "period" | "breast" | "general" | "sleep" | "fall" | "confusion";
const AREAS: Record<"now" | "today" | "soon", Area[]> = {
  now: ["heart", "gut", "gut", "gut", "heart", "head", "head", "confusion", "fall"],
  today: ["gut", "gut", "gut", "bladder", "bladder", "period", "head", "breast", "heart", "fall"],
  soon: ["gut", "gut", "gut", "general", "bladder", "period", "breast", "general", "heart", "sleep", "fall"],
};
/** The areas a question is about. ("general" signs always show; a question with only
 *  "general" gets those first and the rest under "Other signs".) The parent questions use
 *  the same signs: stroke and chest-pain signs read the same for an older parent. */
const AREAS_OF: Record<string, Area[]> = {
  headache: ["head"], migraine: ["head"], "eye-strain": ["head"], dizzy: ["head", "heart"], "tinnitus-louder": ["head"], "jaw-sore-morning": ["head"],
  "headache-stopped-me": ["head"], "took-painkiller": ["head"],
  "stomach-issues": ["gut"], "felt-nauseous": ["gut"], heartburn: ["gut", "heart"], bloated: ["gut"], "hard-to-poop": ["gut"], "loose-stool": ["gut"], "pooped-today": ["gut"], "piles-bothered": ["gut"],
  "heart-palpitations": ["heart"], "back-or-neck-pain": ["heart", "bladder"], "neck-pain": ["heart", "head"],
  "panic-attack": ["heart", "head"], "snored-or-gasped": ["sleep", "heart"], "felt-fatigued": ["general"],
  "period-symptoms": ["period"], "period-day": ["period"], "heavy-flow-day": ["period"], "pms-signs": ["period", "breast"], "hot-flushes": ["period"], "night-sweats": ["period", "general"], "pill-free-day": ["period"],
  "bladder-urgency": ["bladder"], "bladder-leak": ["bladder"], "night-pee-2-plus": ["bladder"], "pee-burning": ["bladder"],
  "breast-tender": ["breast"],
  "parent-confused": ["confusion", "head"], "parent-stumbled": ["fall", "head"], "parent-pain": ["heart", "gut"],
};

/** A card with one chip only (the chip row has no room for two): the free line to talk
 *  to someone is in this sheet too (content review, Nov 9 2026: a panic attack can also
 *  be the heart, and it still needs someone to talk to). */
const TALK_TOO = new Set(["panic-attack"]);

const Group = ({ title, items, tone }: { title: string; items: string[]; tone: "now" | "today" | "soon" }) => items.length === 0 ? null : (
  <div className="surface mt-3 shrink-0 rounded-[20px] px-4 py-3.5">
    <p className={`text-[17px] font-bold ${tone === "now" ? "text-[hsl(var(--strong))]" : ""}`}>{title}</p>
    <ul className="mt-1.5 space-y-1.5">
      {items.map((x) => <li key={x} className="flex gap-2 text-[15px] font-semibold leading-snug"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />{x}</li>)}
    </ul>
  </div>
);

export const RedFlagsSheet = ({ open, onClose, about }: { open: boolean; onClose: () => void; about?: string | null }) => {
  const { t } = useTranslation();
  const talk = !!about && TALK_TOO.has(about);
  const [more, setMore] = useState(false);
  const all = (k: "now" | "today" | "soon") => t(`redFlags.${k}`, { returnObjects: true }) as unknown as string[];
  // the question's own signs first; with nothing to match, everything
  const want = about ? AREAS_OF[about] : undefined;
  const mine = (k: "now" | "today" | "soon", x: string, i: number) => !want || want.includes(AREAS[k][i] ?? "general") || AREAS[k][i] === "general";
  const list = (k: "now" | "today" | "soon") => all(k).filter((x, i) => mine(k, x, i));
  const rest = (k: "now" | "today" | "soon") => (want ? all(k).filter((x, i) => !mine(k, x, i)) : []);
  const hasRest = !!want && (["now", "today", "soon"] as const).some((k) => rest(k).length > 0);
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={t("redFlags.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
        <h2 className="pt-1 text-[24px] font-bold leading-tight">{t("redFlags.title")}</h2>
        <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{t("redFlags.line")}</p>
        <p className="surface mt-4 rounded-[20px] px-4 py-3.5 text-[16px] font-bold leading-snug text-[hsl(var(--strong))]">{t("redFlags.call")}</p>
        {talk && (
          <div className="surface mt-3 shrink-0 rounded-[20px] px-4 py-3.5">
            <p className="text-[17px] font-bold">{t("support.title")}</p>
            <p className="mt-1 text-[15px] font-semibold leading-snug">{t("support.line")}</p>
            <p className="mt-2 text-[14px] font-semibold leading-snug text-muted-foreground">{t("support.findTalk")}</p>
          </div>
        )}
        <Group tone="now" title={t("redFlags.nowTitle")} items={list("now")} />
        <Group tone="today" title={t("redFlags.todayTitle")} items={list("today")} />
        <Group tone="soon" title={t("redFlags.soonTitle")} items={list("soon")} />
        {hasRest && (
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="mt-4 flex items-center gap-1.5 self-start text-[16px] font-bold text-[hsl(var(--coin-teal))]">
            {t("redFlags.other")}<ChevronDown className={`h-5 w-5 transition-transform ${more ? "rotate-180" : ""}`} strokeWidth={2.4} />
          </button>
        )}
        {hasRest && more && (
          <>
            <Group tone="now" title={t("redFlags.nowTitle")} items={rest("now")} />
            <Group tone="today" title={t("redFlags.todayTitle")} items={rest("today")} />
            <Group tone="soon" title={t("redFlags.soonTitle")} items={rest("soon")} />
          </>
        )}
        <p className="mt-4 text-[13px] font-semibold text-muted-foreground">{t("redFlags.source")}</p>
      </div>
    </BottomSheet>
  );
};
