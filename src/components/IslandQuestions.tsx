// The questions on an island (Aurora, Nov 2 2026; her ask: "в рамках
// острова тоже могут свои вопросы писать… при создании первого вопроса —
// онбординг"). "+ Add a question here" writes one in her own words; the
// first time, two short lines say how. Whether YES is a hard day is her
// pick (sun or storm), never guessed.
// Nov 3 2026 (her notes): each question has a "⋯" with "Move to another
// island" and "Remove" (archived, answers kept); writing one asks when it's
// time to act in three plain choices + her plan; ideas fold away.
import { isCovered } from "@/lib/bodyTemplates";
import { templateIdOf } from "@/lib/answerPhrases";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker } from "@/types/tracker";
import { islandName, mapPic, type Island, type IslandId } from "@/lib/islands";
import { addQuestionToIsland, removeQuestion, setTrackerIsland } from "@/lib/ownIslands";
import { cardQuestion, templateQuestion } from "@/lib/cardText";
import { Pressable } from "@/components/ui/pressable";
import { hasTemplate, topicTemplates } from "@/components/NewIslandSheet";
import { ensureTemplates } from "@/lib/doors";
import { localizeTrackerQuestion } from "@/lib/trackerLocalize";
import { RuleChips } from "@/components/RuleChips";
import { RULES, type RuleKey } from "@/lib/rules";

const GUIDE_KEY = "memap_first_question_seen";

export const IslandQuestions = ({ island, islands, trackers }: { island: Island; islands: Island[]; trackers: Tracker[] }) => {
  const { t } = useTranslation();
  const mine = trackers.filter((tr) => island.trackerIds.includes(tr.id) && !tr.archived);
  // The open "⋯" menu (move / remove), and a remove waiting for "Yes".
  const [menu, setMenu] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(mine.length === 0);
  const [text, setText] = useState("");
  const [hard, setHard] = useState<boolean | null>(null);
  const [rule, setRule] = useState<RuleKey>("off");
  const [plan, setPlan] = useState("");
  const [ask, setAsk] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [guide] = useState(() => {
    try { return localStorage.getItem(GUIDE_KEY) !== "true"; } catch { return false; }
  });
  const [saved, setSaved] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    if (hard === null) { setAsk(true); haptics.tap(); return; }
    haptics.success();
    await addQuestionToIsland(text, island.id, hard, RULES[rule], plan);
    try { localStorage.setItem(GUIDE_KEY, "true"); } catch { /* shows again, harmless */ }
    setText("");
    setHard(null);
    setRule("off");
    setPlan("");
    setAsk(false);
    setSaved(true);
  };

  const haveIds = trackers.map((tr) => templateIdOf(tr)).filter((x): x is string => !!x);
  const ideas = topicTemplates(island.id).filter((tpl) => !hasTemplate(trackers, tpl) && !isCovered(tpl.id, haveIds)).slice(0, 4);

  return (
    <div className="space-y-2.5 pb-2">
      <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("islands.questionsHere", { count: mine.length })}</p>
      {mine.map((tr) => (
        <div key={tr.id} className="surface rounded-[20px] px-4 py-3">
          <div className="flex items-center gap-3">
            {/* the question opens its own page: days, links, when to act, what helps (ThingSheet, Nov 13 2026) */}
            <button type="button" data-open-thing={tr.id} onClick={() => { haptics.tap(); window.dispatchEvent(new CustomEvent("memap-open-thing", { detail: { id: tr.id } })); }}
              className="min-w-0 flex-1 text-left text-[16px] font-semibold leading-snug">{cardQuestion(tr)}</button>
            <button type="button" onClick={() => { haptics.tap(); setMenu((m) => (m === tr.id ? null : tr.id)); setRemoving(null); }}
              aria-label={t("islands.more")} aria-expanded={menu === tr.id}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground">
              <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>
          {menu === tr.id && removing !== tr.id && (
            <div className="mt-3 space-y-2.5 animate-fade-in">
              {islands.filter((i) => i.id !== island.id).length > 0 && (
                <>
                  <p className="text-[14px] font-semibold text-muted-foreground">{t("islands.move")}</p>
                  <div className="flex flex-wrap gap-2">
                    {islands.filter((i) => i.id !== island.id).map((i) => (
                      <button key={i.id} type="button" onClick={async () => { haptics.tap(); setMenu(null); await setTrackerIsland(tr.id, i.id); }}
                        className="surface inline-flex h-10 items-center gap-1.5 rounded-full pl-1 pr-3 text-[14px] font-semibold">
                        <img src={mapPic("icon_" + i.def.icon)} alt="" width={26} height={26} />
                        {islandName(t, i.id as IslandId)}
                      </button>
                    ))}
                    {tr.island && (
                      <button type="button" onClick={async () => { haptics.tap(); setMenu(null); await setTrackerIsland(tr.id, undefined); }}
                        className="inline-flex h-10 items-center rounded-full px-3 text-[14px] font-semibold text-muted-foreground">
                        {t("islands.backHome")}
                      </button>
                    )}
                  </div>
                </>
              )}
              <button type="button" onClick={() => { haptics.warning(); setRemoving(tr.id); }}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground/[0.05] px-3.5 text-[14px] font-semibold text-foreground/80">
                <Trash2 className="h-4 w-4" strokeWidth={2.2} /> {t("islands.remove")}
              </button>
            </div>
          )}
          {removing === tr.id && (
            <div className="mt-3 space-y-2 animate-fade-in">
              <p className="text-[15px] font-semibold leading-snug">{t("islands.removeAsk")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={async () => { haptics.medium(); setRemoving(null); setMenu(null); await removeQuestion(tr.id); }}
                  className="h-11 flex-1 rounded-full bg-foreground text-[15px] font-bold text-background">{t("islands.removeYes")}</button>
                <button type="button" onClick={() => { haptics.tap(); setRemoving(null); }}
                  className="h-11 flex-1 rounded-full bg-foreground/[0.06] text-[15px] font-semibold">{t("common.cancel")}</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {saved && <p className="px-1 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">{t("islands.added")}</p>}

      {!adding ? (
        <button type="button" onClick={() => { haptics.tap(); setAdding(true); setSaved(false); }}
          className="quiet-btn h-12 w-full text-[16px]">
          <Plus className="h-5 w-5" strokeWidth={2.4} /> {t("islands.addHere")}
        </button>
      ) : (
        <div className="surface space-y-3.5 rounded-[20px] px-4 py-3.5">
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
          <p className={cn("text-[16px] font-bold", ask && "text-[hsl(var(--coin-teal))]")}>{t("islands.yesIs")}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[false, true].map((h) => (
              <button key={String(h)} type="button" onClick={() => { haptics.tap(); setHard(h); setAsk(false); }} aria-pressed={hard === h}
                className={cn("flex h-14 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold",
                  hard === h ? "surface pick-on font-bold" : "bg-foreground/[0.05]",
                  ask && hard === null && "ring-2 ring-[hsl(var(--coin-teal)/0.5)]")}>
                <img src={mapPic(h ? "thunder_cloud" : "sun")} alt="" width={28} height={28} className="object-contain" />
                {t(h ? "islands.hard" : "islands.good")}
              </button>
            ))}
          </div>
          {/* When is it time to act (only once she said what a yes means). */}
          {hard !== null && (
            <RuleChips hard={hard} value={rule} onChange={(k) => setRule(k)} plan={plan} onPlan={setPlan} />
          )}
          <Pressable tone="teal" haptic="none" disabled={!text.trim()} onClick={add} className="h-[52px] w-full rounded-2xl disabled:opacity-50" faceClassName="text-[15px] font-extrabold uppercase tracking-[0.06em]">
            {ask ? t("islands.goodOrHard") : t("islands.add")}
          </Pressable>
        </div>
      )}

      {/* Ready questions for this island, one tap each, folded away. */}
      {ideas.length > 0 && (
        <>
          <button type="button" onClick={() => { haptics.tap(); setIdeasOpen((o) => !o); }} aria-expanded={ideasOpen}
            className="flex h-11 items-center gap-1.5 px-1 text-[15px] font-semibold text-muted-foreground">
            {t("islands.ideas")} ({ideas.length})
            <ChevronDown className={cn("h-4 w-4 transition-transform", ideasOpen && "rotate-180")} />
          </button>
          {ideasOpen && ideas.map((tpl) => (
            <button key={tpl.id} type="button"
              onClick={async () => { haptics.pop(0.35); await ensureTemplates([tpl.id]); window.dispatchEvent(new Event("memap-settings-changed")); }}
              className="surface flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left animate-fade-in">
              <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{templateQuestion(tpl)}</span>
              <span className="icon-dot h-8 w-8"><Plus className="h-4 w-4" strokeWidth={2.6} /></span>
            </button>
          ))}
        </>
      )}
    </div>
  );
};
