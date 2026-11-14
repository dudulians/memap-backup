// A link between two islands, opened from its dotted route on the Map or the
// Globe (her note, Nov 5 2026, WORLD-BIBLE "Решения 5 ноября" #4): which two
// questions, how many times out of how many, and, honestly, that this is what
// happened together in her days, not proof of a cause.
// Since Nov 12 2026 (her pick) the same look as a link in Links (LinkParts): the sentence, the count large with a
// small "Chart" at its side, the dots, the other days, and on the same day "What comes first?" with what else to watch.
import { TipCard, tourCompleted } from "./Tips";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { computeCorrelations } from "@/lib/correlations";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { islandName, islandOf, linkWorthShowing, LINKS_TOP, type Route } from "@/lib/islands";
import { linkHead, trackerLookup } from "@/lib/linkText";
import { answerPhrase, cap } from "@/lib/answerPhrases";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { OwnWordsPrompt } from "./AnswerWordsFields";
import { LinkIsles, LinkNumbers, OrderAsk, PAIR_A, PAIR_B, trackedTemplates, weeksWith } from "./LinkParts";
import { findLink, LinkCard, makeDaysWith } from "./FindingsView";

export const LinkSheet = ({ route, trackers, entries, days, onClose, onChart }: {
  route: Route | null;
  trackers: Tracker[];
  /** the answers: the link's days as bars */
  entries: TrackerEntry[];
  /** evenings answered on each island: its picture at its stage */
  days: Record<string, number>;
  onClose: () => void;
  /** the two questions on the chart */
  onChart: (ids: string[]) => void;
}) => {
  const { t } = useTranslation();
  const of = trackerLookup(trackers);
  const r = route;
  // the same card as in Links (her note, Nov 12 2026: the two looked different); the old look only if Links doesn't
  // show this link
  const c = r ? findLink(trackers, entries, r.first, r.second, r.nextDay) : null;
  // every link between these two islands, not only the one the route was drawn for (her note, Nov 14 2026: «между
  // островами показывается только одна связь… пусть показываются все связи по связке этих островов»), the route's own first
  const all = useMemo(() => {
    if (!r) return [];
    const pair = (c2: { trackerA: Tracker; trackerB: Tracker }) => { const A = islandOf(c2.trackerA), B = islandOf(c2.trackerB); return (A === r.a && B === r.b) || (A === r.b && B === r.a); };
    const list = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing).filter(pair);
    return c ? [c, ...list.filter((x) => !(x.trackerA.id === c.trackerA.id && x.trackerB.id === c.trackerB.id && x.lag === c.lag))] : list;
  }, [r, c, trackers, entries]);
  return (
    <BottomSheet open={!!r} onOpenChange={(o) => { if (!o) onClose(); }} ariaTitle={t("link.title")}>
      {r && (
        <div data-link-sheet className="px-5 pb-8 pt-1">
          {!tourCompleted() && <TipCard id="block:findings" className="mb-4" title={t("tour.links.title")} line={t("tour.links.line")} />}
          {all.length > 0 ? (<>
            {all.length > 1 && <p data-link-between className="mb-3 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{t("link.between", { a: islandName(t, r.a), b: islandName(t, r.b), count: all.length })}</p>}
            <div className="space-y-3">
              {all.map((x, i) => <LinkCard key={`${x.trackerA.id}|${x.trackerB.id}|${x.lag}`} c={x} hero={i === 0} of={of} entries={entries} tracked={trackedTemplates(trackers)} startOpen={i === 0} kicker={all.length > 1 ? undefined : t("link.title")} />)}
            </div>
          </>) : (<>
          {/* the two islands and the dotted route between them */}
          <LinkIsles r={r} days={days} />
          <p data-link-sentence className="mt-5 text-[21px] font-bold leading-snug tracking-tight">{linkHead(t, r, of)}</p>
          {/* her own questions without words read clumsily: she can name them short (Nov 11–12 2026) */}
          <OwnWordsPrompt trackers={[of(r.first), of(r.second)]} />
          <div className="mt-4"><LinkNumbers r={r} onChart={() => onChart([r.first, r.second])} bars={[
            { label: cap(answerPhrase(t, of(r.first), r.firstYes)), weeks: weeksWith(entries, r.first, r.firstYes), color: PAIR_A },
            { label: cap(answerPhrase(t, of(r.second), r.secondYes)), weeks: weeksWith(entries, r.second, r.secondYes), color: PAIR_B },
          ]} /></div>
          {/* the same day: what comes first is the person's guess (her idea, Nov 12 2026) */}
          {!r.nextDay && <OrderAsk r={r} of={of} tracked={trackedTemplates(trackers)} />}
          </>)}
        </div>
      )}
    </BottomSheet>
  );
};
