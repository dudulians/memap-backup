// An island's questions, one at a time (her pick, Nov 15 2026, board C: «вопрос переключается, как в календаре: стрелки
// ‹ › и "Question 1 of 2 ▾"; ниже всё про этот вопрос»; «▾ открывает вопросы острова: сначала твои, потом
// предложенные; здесь же Add a question»). The four rows under it are the thing's own (ThingBody).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { islandName, type Island } from "@/lib/islands";
import { cardQuestion } from "@/lib/cardText";
import { yoursOf } from "@/lib/yours";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ThingBody, type ThingActions } from "./ThingBody";
import { IslandQuestions } from "./IslandQuestions";

export const IslandThings = ({ island, islands, trackers, entries, pick, ...acts }: {
  island: Island; islands: Island[]; trackers: Tracker[]; entries: TrackerEntry[];
  /** the question to show first (opened from a link card or My questions) */ pick?: string | null;
} & ThingActions) => {
  const { t } = useTranslation();
  // hers first, then the suggested ones, each in the order they came
  const list = useMemo(() => {
    const mine = trackers.filter((tr) => island.trackerIds.includes(tr.id) && !tr.archived);
    return [...mine.filter((tr) => yoursOf(tr)), ...mine.filter((tr) => !yoursOf(tr))];
  }, [trackers, island]);
  const [at, setAt] = useState(() => Math.max(0, list.findIndex((tr) => tr.id === pick)));
  useEffect(() => { const i = list.findIndex((tr) => tr.id === pick); if (i >= 0) setAt(i); }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const [listOpen, setListOpen] = useState(false);
  if (list.length === 0) return <IslandQuestions key={island.id} island={island} islands={islands} trackers={trackers} />;
  const i = Math.min(at, list.length - 1);
  const tr = list[i];
  const mine = yoursOf(tr);
  const step = (d: number) => { haptics.tap(); setAt((k) => Math.max(0, Math.min(list.length - 1, k + d))); };
  const arrow = "grid h-9 w-8 shrink-0 place-items-center text-foreground/70 disabled:text-foreground/20";
  return (
    <div data-island-things>
      {/* the question as plain text, a small pager beside it (no big card) */}
      <div data-question-switcher className="flex items-start gap-2">
        <p data-switcher-question className="min-w-0 flex-1 pt-1 text-[18px] font-bold leading-snug">{cardQuestion(tr)}</p>
        <div className="flex h-9 shrink-0 items-center rounded-full bg-foreground/[0.06]">
          <button type="button" onClick={() => step(-1)} disabled={i === 0} aria-label={t("islandQ.prev")} className={arrow}>
            <ChevronLeft className="h-4 w-4" strokeWidth={2.8} />
          </button>
          <button type="button" data-question-list onClick={() => { haptics.tap(); setListOpen(true); }} aria-label={t("islandQ.ofAria", { k: i + 1, n: list.length })}
            className="inline-flex h-9 items-center gap-0.5 text-[13px] font-bold tabular-nums text-foreground/80">
            {t("islandQ.of", { k: i + 1, n: list.length })}<ChevronDown className="h-3.5 w-3.5" strokeWidth={2.8} />
          </button>
          <button type="button" onClick={() => step(1)} disabled={i === list.length - 1} aria-label={t("islandQ.next")} className={arrow}>
            <ChevronRight className="h-4 w-4" strokeWidth={2.8} />
          </button>
        </div>
      </div>
      <p data-question-whose className={cn("mb-3 mt-1 flex items-center gap-1 text-[13px] font-bold",
        mine ? "text-[hsl(var(--coin-teal))]" : "text-muted-foreground")}>
        {mine && <Star className="h-3 w-3 fill-current" strokeWidth={2.4} />}
        {t(mine === "came" ? "islandQ.yoursCame" : mine === "own" ? "islandQ.yoursOwn" : "islandQ.suggested")}
      </p>
      <ThingBody key={tr.id} tracker={tr} trackers={trackers} entries={entries} {...acts} />

      {/* ▾: the island's questions, hers first; pick one, move or remove one, add one here */}
      <BottomSheet open={listOpen} onOpenChange={(o) => { if (!o) setListOpen(false); }} className="h-auto max-h-[85vh]" ariaTitle={t("islandQ.listTitle", { island: islandName(t, island.id) })}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <h2 className="pb-2 pr-10 pt-1 text-[22px] font-bold tracking-tight">{t("islandQ.listTitle", { island: islandName(t, island.id) })}</h2>
          <IslandQuestions key={island.id} island={island} islands={islands} trackers={trackers} current={tr.id}
            onPick={(id) => { const k = list.findIndex((x) => x.id === id); if (k >= 0) setAt(k); setListOpen(false); }} />
        </div>
      </BottomSheet>
    </div>
  );
};
