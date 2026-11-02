// The questions on an island (Aurora, Nov 2 2026; her ask: "в рамках
// острова тоже могут свои вопросы писать… при создании первого вопроса —
// онбординг"). Each question can move to another island; "+ Add a
// question here" writes one in her own words. The first time, two short
// lines say how. Whether YES is a hard day is her pick (sun or storm),
// never guessed.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker } from "@/types/tracker";
import { islandName, mapPic, type Island, type IslandId } from "@/lib/islands";
import { addQuestionToIsland, setTrackerIsland } from "@/lib/ownIslands";
import { cardQuestion } from "@/lib/cardText";
import { Pressable } from "@/components/ui/pressable";
import { hasTemplate, topicTemplates } from "@/components/NewIslandSheet";
import { ensureTemplates } from "@/lib/doors";
import { localizeTrackerQuestion } from "@/lib/trackerLocalize";

const GUIDE_KEY = "memap_first_question_seen";

export const IslandQuestions = ({ island, islands, trackers }: { island: Island; islands: Island[]; trackers: Tracker[] }) => {
  const { t } = useTranslation();
  const mine = trackers.filter((tr) => island.trackerIds.includes(tr.id));
  const [moving, setMoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(mine.length === 0);
  const [text, setText] = useState("");
  const [hard, setHard] = useState<boolean | null>(null);
  const [ask, setAsk] = useState(false);
  const [guide] = useState(() => {
    try { return localStorage.getItem(GUIDE_KEY) !== "true"; } catch { return false; }
  });
  const [saved, setSaved] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    if (hard === null) { setAsk(true); haptics.tap(); return; }
    haptics.success();
    await addQuestionToIsland(text, island.id, hard);
    try { localStorage.setItem(GUIDE_KEY, "true"); } catch { /* shows again, harmless */ }
    setText("");
    setHard(null);
    setAsk(false);
    setSaved(true);
  };

  const ideas = topicTemplates(island.id).filter((tpl) => !hasTemplate(trackers, tpl)).slice(0, 4);

  return (
    <div className="space-y-2.5 pb-4">
      <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("islands.questionsHere", { count: mine.length })}</p>
      {mine.map((tr) => (
        <div key={tr.id} className="surface rounded-[20px] px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{cardQuestion(tr)}</p>
            <button type="button" onClick={() => { haptics.tap(); setMoving((m) => (m === tr.id ? null : tr.id)); }}
              aria-label={t("islands.move")} aria-expanded={moving === tr.id}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
          {moving === tr.id && (
            <div className="mt-3 flex flex-wrap gap-2">
              {islands.filter((i) => i.id !== island.id).map((i) => (
                <button key={i.id} type="button" onClick={async () => { haptics.tap(); setMoving(null); await setTrackerIsland(tr.id, i.id); }}
                  className="surface inline-flex h-10 items-center gap-1.5 rounded-full pl-1 pr-3 text-[14px] font-semibold">
                  <img src={mapPic("icon_" + i.def.icon)} alt="" width={26} height={26} />
                  {islandName(t, i.id as IslandId)}
                </button>
              ))}
              {tr.island && (
                <button type="button" onClick={async () => { haptics.tap(); setMoving(null); await setTrackerIsland(tr.id, undefined); }}
                  className="inline-flex h-10 items-center rounded-full px-3 text-[14px] font-semibold text-muted-foreground">
                  {t("islands.backHome")}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {saved && <p className="px-1 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">{t("islands.added")}</p>}

      {!adding ? (
        <button type="button" onClick={() => { haptics.tap(); setAdding(true); setSaved(false); }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-foreground/15 text-[16px] font-semibold text-foreground/80">
          <Plus className="h-5 w-5" strokeWidth={2.4} /> {t("islands.addHere")}
        </button>
      ) : (
        <div className="surface space-y-3 rounded-[20px] px-4 py-3.5">
          {guide && (
            <div className="space-y-1">
              <p className="text-[15px] font-semibold">{t("islands.guide1")}</p>
              <p className="text-[15px] font-semibold">{t("islands.guide2")}</p>
            </div>
          )}
          <input value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} maxLength={80} enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder={t("islands.questionPh")} aria-label={t("islands.addHere")}
            className="h-12 w-full rounded-xl bg-foreground/[0.05] px-3 text-[17px] font-semibold outline-none placeholder:text-muted-foreground/70" />
          {/* Gentle nudge toward yes/no; never blocks. */}
          {/^(how|what|why|сколько|как|что|почему)\b/i.test(text.trim()) && <p className="text-[14px] font-medium text-muted-foreground">{t("islands.yesNoTip")}</p>}
          <p className={cn("text-[15px] font-bold", ask && "text-[hsl(var(--coin-teal))]")}>{t("islands.yesIs")}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[false, true].map((h) => (
              <button key={String(h)} type="button" onClick={() => { haptics.tap(); setHard(h); setAsk(false); }} aria-pressed={hard === h}
                className={cn("flex h-14 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold",
                  hard === h ? "bg-[hsl(var(--coin-teal)/0.14)] ring-2 ring-[hsl(var(--coin-teal))]" : "bg-foreground/[0.05]",
                  ask && hard === null && "ring-2 ring-[hsl(var(--coin-teal)/0.5)]")}>
                <img src={mapPic(h ? "thunder_cloud" : "sun")} alt="" width={28} height={28} className="object-contain" />
                {t(h ? "islands.hard" : "islands.good")}
              </button>
            ))}
          </div>
          <Pressable tone="teal" haptic="none" disabled={!text.trim()} onClick={add} className="h-[52px] w-full rounded-2xl disabled:opacity-50" faceClassName="text-[15px] font-extrabold uppercase tracking-[0.06em]">
            {ask ? t("islands.goodOrHard") : t("islands.add")}
          </Pressable>
        </div>
      )}

      {/* Ready questions for this island, one tap each. */}
      {ideas.length > 0 && (
        <>
          <p className="pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("islands.ideas")}</p>
          {ideas.map((tpl) => (
            <button key={tpl.id} type="button"
              onClick={async () => { haptics.success(); await ensureTemplates([tpl.id]); window.dispatchEvent(new Event("memap-settings-changed")); }}
              className="surface flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left">
              <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{localizeTrackerQuestion(tpl.questionText)}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-teal)/0.12)] text-[hsl(var(--coin-teal))]"><Plus className="h-4 w-4" strokeWidth={2.6} /></span>
            </button>
          ))}
        </>
      )}
    </div>
  );
};
