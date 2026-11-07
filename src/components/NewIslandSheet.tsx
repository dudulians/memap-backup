// "+ New island" (Aurora, Nov 2 2026; her note: "когда на карте отжимаешь
// новый остров, нужно чтоб выходил список возможных категорий и потом как-то
// и вопросы"). First the topics not on her map yet (Work, Pet, Parents…)
// and "My own topic"; then that topic's questions to tick, the starter ones
// ticked already. The new island appears with them.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker } from "@/types/tracker";
import { LIFE_STREAMS, type LifeStreamTemplate } from "@/lib/lifeStreams";
import { ISLAND_DEFS, islandName, mapPic, WORK_TEMPLATES, type BuiltinIsland, type Island, type IslandId } from "@/lib/islands";
import { ensureTemplates } from "@/lib/doors";
import { localizeTrackerQuestion, localizeTrackerTitleRaw } from "@/lib/trackerLocalize";
import { templateQuestion } from "@/lib/cardText";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Pressable } from "@/components/ui/pressable";

/** Library topics by the island they make. */
const TOPICS: { island: BuiltinIsland; streams?: string[]; ids?: string[] }[] = [
  { island: "work", ids: [...WORK_TEMPLATES] },
  { island: "love", streams: ["partner"] },
  { island: "kids", streams: ["parenting", "child-wellbeing"] },
  { island: "health", streams: ["health"] },
  { island: "body", streams: ["habits"] },
  { island: "me", streams: ["state", "big-decisions"] },
  { island: "pet", streams: ["pet"] },
  { island: "parents", streams: ["elderly-parent"] },
  { island: "world", streams: ["external-events", "expat"] },
];

// intimacy questions are never offered (Nov 7 2026)
const ALL = LIFE_STREAMS.flatMap((s) => s.templates.filter((tpl) => !tpl.sensitive).map((tpl) => ({ tpl, stream: s.id })));

/** The library questions of an island's topic, starter ones first. */
export const topicTemplates = (island: IslandId): LifeStreamTemplate[] => {
  const topic = TOPICS.find((x) => x.island === island);
  if (!topic) return [];
  const list = topic.ids
    ? ALL.filter((x) => topic.ids!.includes(x.tpl.id)).map((x) => x.tpl)
    : ALL.filter((x) => topic.streams!.includes(x.stream) && !WORK_TEMPLATES.has(x.tpl.id)).map((x) => x.tpl);
  return [...list.filter((t) => t.featured), ...list.filter((t) => !t.featured)];
};

/** Is this library question already one of hers? (same title) */
export const hasTemplate = (trackers: Tracker[], tpl: LifeStreamTemplate) => {
  const title = localizeTrackerTitleRaw(tpl.title).trim().toLowerCase();
  return trackers.some((tr) => !tr.archived && tr.title.trim().toLowerCase() === title);
};

export const NewIslandSheet = ({
  islands,
  trackers,
  onClose,
  onMakeOwn,
  onCreated,
  canOwn = true,
}: {
  islands: Island[];
  trackers: Tracker[];
  onClose: () => void;
  onMakeOwn: () => void;
  onCreated: (id: IslandId) => void;
  /** room for one more island of her own (up to 6) */
  canOwn?: boolean;
}) => {
  const { t } = useTranslation();
  const present = new Set(islands.map((i) => i.id));
  const topics = TOPICS.filter((x) => !present.has(x.island));
  const [topic, setTopic] = useState<BuiltinIsland | null>(null);
  const templates = useMemo(() => (topic ? topicTemplates(topic) : []), [topic]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const openTopic = (id: BuiltinIsland) => {
    haptics.tap();
    const list = topicTemplates(id);
    const starters = list.filter((tpl) => !hasTemplate(trackers, tpl)).slice(0, 3);
    setPicked(new Set(starters.map((x) => x.id)));
    setTopic(id);
  };
  const toggle = (id: string) => {
    haptics.tap();
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const add = async () => {
    if (!topic || picked.size === 0 || busy) return;
    setBusy(true);
    haptics.success();
    await ensureTemplates([...picked]);
    window.dispatchEvent(new Event("memap-settings-changed"));
    onCreated(topic);
  };

  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={t("islands.new")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
        {!topic ? (
          <>
            <h2 className="pb-1 pr-10 pt-1 text-[24px] font-bold tracking-tight">{t("islands.new")}</h2>
            <p className="pb-3 text-[15px] font-medium text-muted-foreground">{t("islands.pickTopic")}</p>
            <div className="surface divide-y divide-foreground/[0.06] overflow-hidden rounded-[20px]">
              {topics.map((x) => (
                <button key={x.island} type="button" onClick={() => openTopic(x.island)} className="flex min-h-[64px] w-full items-center gap-3 px-4 text-left active:bg-foreground/[0.04]">
                  <img src={mapPic("icon_" + ISLAND_DEFS[x.island].icon)} alt="" width={40} height={40} />
                  <span className="flex-1 text-[17px] font-semibold">{islandName(t, x.island)}</span>
                  <span className="text-[14px] font-medium text-muted-foreground">{t("islands.nQuestions", { count: topicTemplates(x.island).length })}</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
                </button>
              ))}
              {canOwn && <button type="button" onClick={() => { haptics.tap(); onMakeOwn(); }} className="flex min-h-[64px] w-full items-center gap-3 px-4 text-left active:bg-foreground/[0.04]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-foreground/20 text-muted-foreground"><Plus className="h-5 w-5" /></span>
                <span className="flex-1 text-[17px] font-semibold">{t("islands.ownTopic")}</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
              </button>}
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setTopic(null)} className="-ml-1 inline-flex h-10 w-fit items-center gap-1 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">
              <ChevronLeft className="h-5 w-5" /> {t("common.back")}
            </button>
            <div className="flex items-center gap-3 pb-3 pr-10">
              <img src={mapPic("icon_" + ISLAND_DEFS[topic].icon)} alt="" width={48} height={48} />
              <h2 className="text-[24px] font-bold tracking-tight">{islandName(t, topic)}</h2>
            </div>
            <p className="pb-3 text-[15px] font-medium text-muted-foreground">{t("islands.pickQuestions")}</p>
            <div className="space-y-2">
              {templates.map((tpl) => {
                const already = hasTemplate(trackers, tpl);
                const on = already || picked.has(tpl.id);
                return (
                  <button key={tpl.id} type="button" disabled={already} onClick={() => toggle(tpl.id)} aria-pressed={on}
                    className={cn("surface flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left", on && !already && "ring-2 ring-[hsl(var(--coin-teal))]", already && "opacity-60")}>
                    <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{templateQuestion(tpl)}</span>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", on ? "border-[hsl(var(--coin-teal))] bg-[hsl(var(--coin-teal))] text-white" : "border-foreground/20")}>
                      {on && <Check className="h-4 w-4" strokeWidth={3.2} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-[hsl(var(--background))] pt-3">
              <Pressable tone="teal" haptic="none" disabled={picked.size === 0 || busy} onClick={add} className="h-[58px] w-full rounded-2xl disabled:opacity-50" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("islands.addN", { count: picked.size })}
              </Pressable>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
};
