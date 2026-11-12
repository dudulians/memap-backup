// A link between two islands, opened from its dotted route on the Map or the
// Globe (her note, Nov 5 2026, WORLD-BIBLE "Решения 5 ноября" #4): which two
// questions, how many times out of how many, and, honestly, that this is what
// happened together in her days, not proof of a cause.
// Since Nov 12 2026 (her pick) the same look as a link in Links (LinkParts): the sentence, the count large with a
// small "Chart" at its side, the dots, the other days, and on the same day "What comes first?" with what else to watch.
import { TipCard, tourCompleted } from "./Tips";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { type Route } from "@/lib/islands";
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
  return (
    <BottomSheet open={!!r} onOpenChange={(o) => { if (!o) onClose(); }} ariaTitle={t("link.title")}>
      {r && (
        <div data-link-sheet className="px-5 pb-8 pt-1">
          {!tourCompleted() && <TipCard id="block:findings" className="mb-4" title={t("tour.links.title")} line={t("tour.links.line")} />}
          {c ? (
            <LinkCard c={c} hero of={of} daysWith={makeDaysWith(entries)} isleDays={days} tracked={trackedTemplates(trackers)} startOpen kicker={t("link.title")} onChart={() => onChart([r!.first, r!.second])} />
          ) : (<>
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
