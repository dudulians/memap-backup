// Onboarding v7 (Nov 6 2026; boards 70–75, her picks after two outside reviews):
//   welcome ("Make sense of your days", a trust line, the globe button)
//   → one topic ("What would you like to understand?"; More topics; your own question)
//   → your daily questions (the main one + a few around it, one screen, all editable)
//   → what you'll discover over time (4 rows, real objects, "patterns, not causes")
//   → the first real check-in on Today's cards (daytime: tonight or yesterday)
//   → "Your world has begun" (WorldBegun.tsx) → a reminder, then Today.
// Setup is apart from the first real answer (GPT's review); the world is the picture
// and the reward, the promise is practical (my review of the world-first brief).
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, Clock, CloudDrizzle, Globe, Lock, Moon, Pencil, Plus, Spline, Sun, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n";
import { avatarUrl, DEFAULT_AVATAR, getAvatar } from "@/lib/avatar";
import { art } from "@/lib/globeArt";
import { ISLAND_DEFS, islandName, islandOf, mapPic, mapPicFor, type Island, type IslandId, type Route } from "@/lib/islands";
import { PlanetGlobe } from "./PlanetGlobe";
import { addOwnTracker, ensureTemplates, findTemplate, getDoor, isoLocal, saveDoorState, type Door, type DoorId } from "@/lib/doors";
import { asQuestion, templateQuestion } from "@/lib/cardText";
import { getTrackers, saveTrackers } from "@/lib/storage";
import type { Tracker } from "@/types/tracker";

/** Several topics (her note, Nov 6 2026: "нет множественного выбора… это неправильно");
 *  the first one picked leads (its island is lit, its calendar is "Your … days"). */
export type V7Pick = { kind: "door"; ids: DoorId[]; own?: string } | { kind: "simple" } | { kind: "own"; text: string };
export const MAX_TOPICS = 3;
/** What the setup made: the questions for the first check-in. */
export interface V7Setup { ids: string[]; mainId: string; doorId: DoorId | null }

// --- pieces ----------------------------------------------------------------------
const Page = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-safe pt-safe animate-fade-in", className)}>{children}</div>
);
/** A screen with a long list: the question stays on top and the button at the bottom; only the
 *  list between them scrolls (her phone test, Nov 7 2026). */
const Screen = ({ head, foot, children }: { head: React.ReactNode; foot: React.ReactNode; children: React.ReactNode }) => (
  <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pt-safe animate-fade-in">
    <div className="shrink-0">{head}</div>
    <div className="onb-scroll -mx-5 min-h-0 flex-1 overflow-y-auto overscroll-none px-5 pb-3">{children}</div>
    <div className="shrink-0 pb-safe pt-2">{foot}</div>
  </div>
);
const Main = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button type="button" onClick={() => { haptics.tap(); onClick(); }} disabled={disabled} data-onb-interactive className="raised-btn mb-5 w-full justify-center disabled:opacity-50">{children}</button>
);
const Pic = ({ name, map = false, className, style }: { name: string; map?: boolean; className?: string; style?: React.CSSProperties }) => (
  <span aria-hidden="true" className={cn("block", className)} style={style}>
    <img className="art-day block w-full" src={map ? mapPicFor(name, false) : art(name, false)} alt="" />
    <img className="art-night block w-full" src={map ? mapPicFor(name, true) : art(name, true)} alt="" />
  </span>
);
const Top = ({ onBack, step, steps = 4 }: { onBack: () => void; step: number; steps?: number }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between pt-4">
      <button type="button" onClick={() => { haptics.tap(); onBack(); }} aria-label={t("common.back")} data-onb-interactive
        className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.08]"><ArrowLeft className="h-5 w-5" strokeWidth={2.2} /></button>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-[22px] bg-[hsl(var(--coin-teal))]" : "w-2 bg-foreground/25")} />)}
      </div>
      <span className="w-11" />
    </div>
  );
};
const H1 = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h1 className={cn("text-[29px] font-bold leading-[1.12] tracking-tight", className)}>{children}</h1>
);
const Row = ({ on, onClick, icon, children, className }: { on: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <button type="button" onClick={() => { haptics.tap(); onClick(); }} aria-pressed={on} data-onb-interactive
    className={cn("surface flex min-h-[52px] w-full items-center gap-3 rounded-[18px] px-4 py-2 text-left text-[17px] font-bold", on && "pick-on", className)}>
    {icon}<span className="min-w-0 flex-1 leading-snug">{children}</span>
    {on && <span className="tick is-on" aria-hidden="true"><Check className="h-4 w-4" strokeWidth={3} /></span>}
  </button>
);
const Dot = ({ door }: { door: Door }) => {
  const Icon = door.icon;
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]"><Icon className={cn("h-5 w-5", door.iconClass)} strokeWidth={2.2} /></span>;
};

// --- 1. welcome --------------------------------------------------------------------
// A whole world on the first screen (her note, Nov 7 2026: "показать много островов на глобусе,
// у тебя как-то выборочно"): seven islands in fixed places and stages, never random.
type DemoId = "health" | "me" | "love" | "kids" | "work" | "body" | "pet";
const demoIsland = (id: DemoId) => ({ id, def: ISLAND_DEFS[id], trackerIds: [id], weather: "sun", hardDays: 0, answeredDays: 0, usual: null, top: null, hardBy: [] }) as unknown as Island;
const DEMO_IDS: DemoId[] = ["health", "me", "love", "kids", "work", "body", "pet"];
const DEMO_ISLANDS: Island[] = DEMO_IDS.map(demoIsland);
const DEMO_DAYS: Record<DemoId, number> = { health: 22, me: 16, love: 9, kids: 6, work: 12, body: 4, pet: 2 };
const route = (a: DemoId, b: DemoId) => ({ a, b, k: 4, n: 5, first: "x", second: "y", nextDay: false, firstYes: true, secondYes: true, other: { k: 1, n: 9 }, secondHard: true });
const DEMO_ROUTES = [route("health", "me"), route("love", "me"), route("work", "health")] as unknown as Route[];
export const WelcomeV7 = ({ onStart, onSimple }: { onStart: () => void; onSimple: () => void }) => {
  const { t } = useTranslation();
  const [lang, setLang] = useState<SupportedLanguage>(getLanguage() === "ru" ? "ru" : "en");
  const [langOpen, setLangOpen] = useState(false);
  const pick = (l: SupportedLanguage) => { haptics.tap(); setLang(l); setLanguage(l); setLangOpen(false); };
  const who = avatarUrl(getAvatar() ?? DEFAULT_AVATAR);
  return (
    <Page>
      {/* the language: one globe button; the list only on tap (v75) */}
      <div className="relative flex justify-end pt-4">
        <button type="button" onClick={() => { haptics.tap(); setLangOpen((v) => !v); }} aria-haspopup="listbox" aria-expanded={langOpen} aria-label={t("settings.language")}
          className="lang-btn surface flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold">
          <Globe className="h-[18px] w-[18px] text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />{lang.toUpperCase()}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", langOpen && "rotate-180")} strokeWidth={2.6} />
        </button>
        {langOpen && (
          <div role="listbox" aria-label={t("settings.language")} className="absolute right-0 top-[60px] z-20 w-[200px] overflow-hidden rounded-[18px] bg-white py-1 shadow-[0_14px_34px_-14px_rgba(20,40,90,.5)] animate-fade-in dark:bg-[hsl(var(--surface))]">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button key={l.code} type="button" role="option" aria-selected={lang === l.code} onClick={() => pick(l.code)} className="flex h-12 w-full items-center justify-between px-4 text-left text-[16px] font-bold">
                {l.native}{lang === l.code && <Check className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={3} />}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* her world as it will be: the same globe as on World, three islands, a link, the boat */}
      <div className="relative -mx-5 mt-1 h-[370px]" aria-hidden="true">
        <PlanetGlobe decor sky={false} islands={DEMO_ISLANDS} routes={DEMO_ROUTES} avatar={who} days={DEMO_DAYS} labels={["health", "me", "love", "work", "body"]} onOpen={() => undefined} />
      </div>
      <div className="min-h-4 flex-1" />
      <H1 className="text-[32px]">{t("onb7.welcomeTitle")}</H1>
      <p className="mt-2 text-[17px] font-semibold leading-snug text-muted-foreground">{t("onb7.welcomeLine")}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {([[Clock, "onb7.trustMin"], [UserX, "onb7.trustAccount"], [Lock, "onb7.trustPhone"]] as const).map(([Icon, k]) => (
          <span key={k} className="trust-chip inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold">
            <Icon className="h-3.5 w-3.5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />{t(k)}
          </span>
        ))}
      </div>
      <div className="h-5" />
      <button type="button" onClick={() => { haptics.tap(); onSimple(); }} data-onb-interactive className="mb-2 h-11 text-[16px] font-bold text-muted-foreground">{t("onb7.startSimple")}</button>
      <Main onClick={() => { setLanguage(lang); onStart(); }}>{t("onb7.getStarted")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></Main>
    </Page>
  );
};

// --- 2. what brings you here --------------------------------------------------------
/** The tone of the topics: something to fix, or more good days (variant A, boards 77). */
export type Tone = "bother" | "good";
export const WhyV7 = ({ onBack, onPick, current }: { onBack: () => void; onPick: (tone: Tone) => void; current?: Tone | null }) => {
  const { t } = useTranslation();
  const opt = (tone: Tone, Icon: typeof Sun, hue: string, label: string) => (
    <button type="button" onClick={() => { haptics.tap(); onPick(tone); }} data-onb-interactive aria-pressed={current === tone}
      className={cn("surface flex min-h-[112px] w-full items-center gap-4 rounded-[22px] px-5 text-left text-[22px] font-extrabold leading-tight", current === tone && "pick-on")}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${hue} / .16)`, color: `hsl(${hue})` }}>
        <Icon className="h-7 w-7" strokeWidth={2.2} />
      </span>
      <span>{label}</span>
    </button>
  );
  return (
    <Page>
      <Top onBack={onBack} step={0} steps={5} />
      <H1 className="mt-5">{t("onb7.whyTitle")}</H1>
      <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("onb7.whySub")}</p>
      <div className="mt-6 flex flex-col gap-3">
        {opt("bother", CloudDrizzle, "230 50% 58%", t("onb7.whyBother"))}
        {opt("good", Sun, "36 85% 50%", t("onb7.whyGood"))}
      </div>
      <div className="min-h-6 flex-1" />
    </Page>
  );
};

// --- 3. the islands and their topics -------------------------------------------------
/** The globe's islands, in this order; the topics inside each, by tone. */
export const ISLAND_TOPICS: Record<Tone, { island: IslandId; ids: DoorId[] }[]> = {
  // each topic under the island its main question lives on (energy and moving are Mind & mood)
  // Nov 8 2026 (her note: "почему так мало вариантов"): 4–8 topics on every island
  bother: [
    { island: "health", ids: ["sleep", "migraine", "period", "headache", "backPain", "stomach", "fatigue"] },
    { island: "me", ids: ["stress", "mood", "energy", "anxiety", "loneliness", "anger", "procrastination", "move"] },
    { island: "love", ids: ["fights", "irritation", "aloneTogether", "phones", "chores"] },
    { island: "kids", ids: ["kid", "bedtime", "meltdowns", "overwhelmed", "childSleep"] },
    { island: "work", ids: ["quit", "overtime", "burnout", "boss", "noWork"] },
    { island: "body", ids: ["drinking", "sweets", "screens", "lateEating", "smoking", "spending"] },
  ],
  good: [
    { island: "health", ids: ["goodSleep", "water", "daylight", "wakeTime", "nature"] },
    { island: "me", ids: ["calm", "joy", "energy", "selfTime", "gratitude", "creative", "reading"] },
    { island: "love", ids: ["closeness", "together", "friends"] },
    { island: "kids", ids: ["kidTime", "brightMoment"] },
    { island: "work", ids: ["focus", "focusHour", "fulfilled"] },
    { island: "body", ids: ["movement", "steps", "veggies", "cooking", "phoneFree"] },
  ],
};
/** Variants B and C (Nov 8 2026): no first door, every topic at once — both tones, island by island. */
const ALL_TOPICS = ISLAND_TOPICS.bother.map((g) => ({ island: g.island, ids: [...new Set([...g.ids, ...(ISLAND_TOPICS.good.find((x) => x.island === g.island)?.ids ?? [])])] }));
export const TopicV7 = ({ tone, onBack, onPick, onOwn, onClearOwn, initial, own, progress = [1, 5] }: {
  tone: Tone | "all"; onBack: () => void; onPick: (ids: DoorId[]) => void; onOwn: (ids: DoorId[]) => void; onClearOwn: () => void; initial?: DoorId[]; own?: string | null; progress?: [number, number];
}) => {
  const { t } = useTranslation();
  const groups = tone === "all" ? ALL_TOPICS : ISLAND_TOPICS[tone];
  const [sel, setSel] = useState<DoorId[]>(initial ?? []);
  // closed at first; an island with a pick stays open (her note: "все списки будут раскрываться?")
  const [opened, setOpened] = useState<IslandId[]>(() => groups.filter((g) => g.ids.some((id) => (initial ?? []).includes(id))).map((g) => g.island));
  const [full, setFull] = useState(false);
  // a 4th pick shakes the chip itself (QA, Nov 8 2026: only the subtitle changed colour)
  const [shake, setShake] = useState<DoorId | null>(null);
  const name = (id: DoorId) => t(id === "energy" && tone === "bother" ? "onb7.lowEnergy" : `doors.${id}.name`);
  const room = MAX_TOPICS - (own ? 1 : 0);
  const toggle = (id: DoorId) => {
    if (sel.includes(id)) { setSel((s) => s.filter((x) => x !== id)); setFull(false); return; }
    if (sel.length >= room) { setFull(true); haptics.warning?.(); setShake(id); window.setTimeout(() => setShake(null), 450); return; }
    setSel((s) => [...s, id]);
  };
  const on = (id: DoorId) => sel.includes(id);
  const openClose = (g: { island: IslandId; ids: DoorId[] }) => {
    haptics.tap();
    const isOpen = opened.includes(g.island);
    if (isOpen && g.ids.some(on)) return; // a picked island stays open
    setOpened((o) => (isOpen ? o.filter((x) => x !== g.island) : [...o, g.island]));
  };
  return (
    <Screen
      head={<>
        <Top onBack={onBack} step={progress[0]} steps={progress[1]} />
        <H1 className="mt-5">{t(tone === "all" ? "onb7.topicTitle" : tone === "good" ? "doors.goodTitle" : "doors.pickTitle")}</H1>
        <p className={cn("mt-1.5 pb-3 text-[16px] font-semibold", full ? "text-[hsl(var(--coin-teal))]" : "text-muted-foreground")} aria-live="polite">{full ? t("onb7.topicMax") : t("onb7.topicSub")}</p>
      </>}
      foot={<Main disabled={sel.length === 0 && !own} onClick={() => { track("door_selected", { door: sel.join(",") || "own", count: sel.length + (own ? 1 : 0), tone }); onPick(sel); }}>{t("doors.continue")}</Main>}>
      <div className="mt-1 flex flex-col gap-2">
        {groups.map((g) => {
          const isOpen = opened.includes(g.island);
          const picked = g.ids.filter(on).length;
          return (
            <div key={g.island} className="surface rounded-[20px] px-3.5">
              <button type="button" onClick={() => openClose(g)} aria-expanded={isOpen} data-onb-interactive
                className="flex h-[54px] w-full items-center gap-3 text-left text-[18px] font-extrabold">
                <img src={mapPic("icon_" + ISLAND_DEFS[g.island as keyof typeof ISLAND_DEFS].icon)} alt="" className="h-9 w-9 shrink-0 object-contain" />
                <span className="min-w-0 flex-1 truncate">{islandName(t, g.island)}</span>
                {picked > 0
                  ? <span className="shrink-0 text-[14px] font-bold text-[hsl(var(--coin-teal))]">{t("onb7.picked", { count: picked })}</span>
                  : isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" strokeWidth={2.4} /> : <ChevronDown className="h-5 w-5 text-muted-foreground" strokeWidth={2.4} />}
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-2 pb-3.5 animate-fade-in">
                  {g.ids.map((id) => (
                    <button key={id} type="button" onClick={() => { haptics.tap(); toggle(id); }} aria-pressed={on(id)} data-onb-interactive
                      className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[16px] font-bold", on(id) ? "pick-on bg-card" : "bg-foreground/[0.05]", shake === id && "path-wiggle-flat")}>
                      {on(id) && <Check className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={3} />}{name(id)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* her own question sits among the topics, ticked; a tap takes it off */}
        {own
          ? <Row on onClick={() => { onClearOwn(); setFull(false); }} icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-teal)/0.12)]"><Pencil className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} /></span>}>{own}</Row>
          : <Row on={false} onClick={() => { if (sel.length >= MAX_TOPICS) { setFull(true); return; } onOwn(sel); }} icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-teal)/0.12)]"><Pencil className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} /></span>}>{t("onb7.writeOwn")}</Row>}
      </div>
    </Screen>
  );
};

// --- 2b. your own question -----------------------------------------------------------
const IDEAS = ["onb7.idea1", "onb7.idea2", "onb7.idea3", "onb7.idea4"];
export const OwnV7 = ({ onBack, onDone, initial = "", progress = [1, 5] }: { onBack: () => void; onDone: (text: string) => void; initial?: string; progress?: [number, number] }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);
  const ok = text.trim().length >= 4;
  return (
    <Page>
      <Top onBack={onBack} step={progress[0]} steps={progress[1]} />
      <H1 className="mt-5">{t("onb7.ownTitle")}</H1>
      <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("onb7.ownSub")}</p>
      <input value={text} onChange={(e) => setText(e.target.value.slice(0, 80))} placeholder={t("onb7.ownPlaceholder")} aria-label={t("onb7.ownTitle")} data-onb-interactive
        className="surface pick-on mt-4 h-14 w-full rounded-[18px] px-4 text-[18px] font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground" />
      {ok && <p className="mt-2 flex items-center gap-1.5 text-[14px] font-bold text-[hsl(var(--coin-teal))]"><Check className="h-4 w-4" strokeWidth={3} />{t("onb7.ownOk")}</p>}
      <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("onb7.ownIdeas")}</p>
      <div className="mt-2 flex flex-col gap-2">
        {IDEAS.map((k) => (
          <button key={k} type="button" onClick={() => { haptics.tap(); setText(t(k)); }} data-onb-interactive className="surface flex min-h-[48px] items-center gap-2.5 rounded-[16px] px-4 text-left text-[16px] font-bold">
            <Plus className="h-4 w-4 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.8} />{t(k)}
          </button>
        ))}
      </div>
      <div className="min-h-6 flex-1" />
      <Main disabled={!ok} onClick={() => onDone(asQuestion(text))}>{t("doors.continue")}</Main>
    </Page>
  );
};

// --- 3. your daily questions --------------------------------------------------------
/** A few more ideas beside a door's own three (unticked). */
const EXTRA: Partial<Record<DoorId, string>> = { migraine: "screens-before-bed", sleep: "felt-stressed", energy: "coffee-late", stress: "meditated", period: "coffee-late", quit: "felt-stressed", move: "felt-stressed" };
const SIMPLE = { main: "had-energy", around: ["slept-enough", "outside-30min", "felt-stressed"] };
const OWN_AROUND = ["slept-enough", "felt-stressed", "outside-30min"];
const islandOfTpl = (id: string): IslandId => { const f = findTemplate(id); return f ? islandOf({ id: "x", title: f.template.title, category: f.template.category, cluster: f.clusterId } as Tracker) : "other"; };
const qOf = (id: string) => { const f = findTemplate(id); return f ? templateQuestion(f.template) : id; };

type MainQ = { key: string; tpl: string | null; base: string; door: Door | null };

/** What a pick asks: the main question of each topic, the ones around them, and the ones ticked to start. */
const planOf = (pick: V7Pick) => {
  const doors = pick.kind === "door" ? pick.ids.map((id) => getDoor(id)).filter((d): d is Door => !!d) : [];
  // one main question per topic (two topics asking the same thing share it), then her own
  const mains: MainQ[] = [];
  if (pick.kind === "simple") mains.push({ key: SIMPLE.main, tpl: SIMPLE.main, base: qOf(SIMPLE.main), door: null });
  for (const d of doors) if (!mains.some((m) => m.tpl === d.mainTemplateId)) mains.push({ key: d.id, tpl: d.mainTemplateId, base: qOf(d.mainTemplateId), door: d });
  const own = pick.kind === "own" ? pick.text : pick.kind === "door" ? pick.own : undefined;
  if (own) mains.push({ key: "own", tpl: null, base: own, door: null });
  const mainTpls = mains.flatMap((m) => (m.tpl ? [m.tpl] : []));
  // the ones around them: every topic's own, in the order picked, no repeats,
  // taken in turns (each topic's first, then each one's second…), so every topic has its own
  const turns: string[] = [];
  for (let k = 0; k < 3; k++) for (const d of doors) { const id = d.contextTemplateIds[k]; if (!turns.includes(id) && !mainTpls.includes(id)) turns.push(id); }
  const aroundTpls = pick.kind === "door"
    ? [...new Set([...turns, ...doors.flatMap((d) => (EXTRA[d.id] ? [EXTRA[d.id]!] : []))])].filter((id) => !mainTpls.includes(id)).slice(0, 8)
    : pick.kind === "simple" ? SIMPLE.around : OWN_AROUND;
  // ticked to start: a topic's three (one topic), one more with each topic added
  const ticked = pick.kind === "door" ? turns.slice(0, 2 + doors.length) : aroundTpls;
  return { doors, mains, aroundTpls, ticked };
};
type Plan = ReturnType<typeof planOf>;

/** Saves the questions: the main ones (in her words where she changed them), the ticked ones around, her own. */
const saveSetup = async (pick: V7Pick, { doors, mains, aroundTpls }: Plan, texts: string[], on: Set<string>, own: string[], quick = false): Promise<V7Setup> => {
  const mainIds: string[] = [];
  for (let i = 0; i < mains.length; i++) {
    const m = mains[i];
    mainIds.push(m.tpl ? (await ensureTemplates([m.tpl]))[0] : await addOwnTracker(texts[i].trim() || m.base));
  }
  // her own words for a main question (cardQuestion shows hers)
  const edited = new Map(mains.flatMap((m, i) => (m.tpl && texts[i].trim() && texts[i].trim() !== m.base ? [[mainIds[i], asQuestion(texts[i])] as const] : [])));
  if (edited.size) {
    const all = await getTrackers();
    await saveTrackers(all.map((x) => (edited.has(x.id) ? { ...x, questionText: edited.get(x.id)! } : x)));
  }
  const aroundIds = await ensureTemplates(aroundTpls.filter((id) => on.has(id)));
  const ownIds: string[] = [];
  for (const q of own) ownIds.push(await addOwnTracker(q));
  const byDoor = mains.flatMap((m, i) => (m.door ? [{ id: m.door.id, trackerId: mainIds[i] }] : []));
  const lead = pick.kind === "simple" ? { id: "energy" as DoorId, trackerId: mainIds[0] } : byDoor[0] ?? null;
  if (lead) saveDoorState({ id: lead.id, trackerId: lead.trackerId, contextTrackerIds: [...aroundIds, ...ownIds], startedAt: isoLocal(new Date()), extra: byDoor.slice(1) });
  track("onboarding_questions", { topic: doors.map((d) => d.id).join(",") || (pick.kind === "simple" ? "energy" : "own"), topics: mains.length, around: aroundIds.length + ownIds.length, edited: edited.size > 0, quick });
  return { ids: [...mainIds, ...aroundIds, ...ownIds], mainId: lead?.trackerId ?? mainIds[0], doorId: lead?.id ?? null };
};
/** Variant C (Nov 8 2026): no questions screen — the questions a pick starts with are saved straight away. */
export const quickSetup = (pick: V7Pick) => { const plan = planOf(pick); return saveSetup(pick, plan, plan.mains.map((m) => m.base), new Set(plan.ticked), [], true); };

export const QuestionsV7 = ({ pick, onBack, onDone, progress = [2, 5] }: { pick: V7Pick; onBack: () => void; onDone: (s: V7Setup) => void; progress?: [number, number] }) => {
  const { t } = useTranslation();
  const plan = useMemo(() => planOf(pick), [pick]);
  const { mains, aroundTpls } = plan;
  const [texts, setTexts] = useState<string[]>(() => mains.map((m) => m.base));
  const [editing, setEditing] = useState<number | null>(null);
  const [on, setOn] = useState<Set<string>>(() => new Set(plan.ticked));
  const [own, setOwn] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isl = (id: string) => islandName(t, islandOfTpl(id));
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const none = on.size === 0 && own.length === 0;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try { onDone(await saveSetup(pick, plan, texts, on, own)); } finally { setBusy(false); }
  };

  return (
    <Screen
      head={<>
        <Top onBack={onBack} step={progress[0]} steps={progress[1]} />
        <H1 className="mt-5">{t("onb7.qTitle")}</H1>
        <p className="mt-1.5 pb-3 text-[16px] font-semibold text-muted-foreground">{t("onb7.qSub")}</p>
      </>}
      foot={<Main disabled={busy || editing !== null} onClick={() => void save()}>{t("doors.continue")}</Main>}>
      {/* the main question of each topic */}
      <div className="mt-1 flex flex-col gap-2.5">
        {mains.map((m, i) => {
          const neutral = m.door?.branch === "thought";
          return (
            <div key={m.key} className="surface pick-on rounded-[20px] px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  <i className={cn("block h-2.5 w-2.5 shrink-0 rounded-full", neutral ? "bg-[hsl(var(--data-a))]" : "bg-[hsl(var(--coin-teal))]")} />
                  {/* whole words, never cut (QA, Nov 8 2026: «НАСТРОЕНИЕ · ГЛАВНЫЙ ВОП…») */}<span className="min-w-0 leading-tight">{m.tpl ? isl(m.tpl) : islandName(t, "mine" as IslandId)} · {t("onb7.qMain")}</span>
                </span>
                {editing !== i && <button type="button" onClick={() => { haptics.tap(); setEditing(i); }} data-onb-interactive className="flex shrink-0 items-center gap-1 text-[14px] font-bold text-[hsl(var(--coin-teal))]"><Pencil className="h-3.5 w-3.5" strokeWidth={2.6} />{t("onb7.qEdit")}</button>}
              </div>
              {editing === i ? (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={texts[i]} onChange={(e) => { const v = e.target.value.slice(0, 80); setTexts((xs) => xs.map((x, k) => (k === i ? v : x))); }} aria-label={t("onb7.qMain")} data-onb-interactive
                    className="h-11 min-w-0 flex-1 rounded-[12px] bg-foreground/[0.05] px-3 text-[17px] font-bold outline-none" />
                  <button type="button" onClick={() => { haptics.tap(); setEditing(null); if (!texts[i].trim()) setTexts((xs) => xs.map((x, k) => (k === i ? m.base : x))); }} data-onb-interactive className="h-11 rounded-[12px] px-3 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("onb7.qDone")}</button>
                </div>
              ) : <p className="mt-1.5 text-[20px] font-bold leading-snug">{texts[i]}</p>}
              {(neutral || mains.length === 1) && <p className="mt-1 text-[14px] font-semibold text-muted-foreground">{neutral ? t("onb7.qNeutral") : t("onb7.qMainLine")}</p>}
            </div>
          );
        })}
      </div>
      {/* the ones around them */}
      <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("onb7.qAlso")}</p>
      <div className="mt-2 flex flex-col gap-2">
        {aroundTpls.map((id) => (
          <Row key={id} on={on.has(id)} onClick={() => toggle(id)} className="text-[16px]"
            >{/* the island on its own small line above, never cut (QA, Nov 8 2026: "MIND & M…") */}<span className="block text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{isl(id)}</span>{qOf(id)}</Row>
        ))}
        {own.map((q, i) => (
          <Row key={`own${i}`} on onClick={() => setOwn((o) => o.filter((_, k) => k !== i))} className="text-[16px]"
            icon={<span className="w-[64px] shrink-0 truncate text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{t("onb7.yours")}</span>}>{q}</Row>
        ))}
        {draft === null ? (
          <button type="button" onClick={() => { haptics.tap(); setDraft(""); }} data-onb-interactive
            className="flex h-12 items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed border-foreground/25 text-[16px] font-bold text-muted-foreground">
            <Plus className="h-4 w-4" strokeWidth={2.8} />{t("onb7.qWrite")}
          </button>
        ) : (
          <div className="flex gap-2">
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 80))} placeholder={t("onb7.ownPlaceholder")} aria-label={t("onb7.qWrite")} data-onb-interactive
              className="surface h-12 min-w-0 flex-1 rounded-[16px] px-4 text-[16px] font-bold outline-none placeholder:font-semibold" />
            <button type="button" disabled={draft.trim().length < 4} onClick={() => { haptics.tap(); setOwn((o) => [...o, asQuestion(draft)]); setDraft(null); }} data-onb-interactive
              className="h-12 rounded-[16px] px-4 text-[15px] font-bold text-[hsl(var(--coin-teal))] disabled:opacity-40">{t("onb7.qAdd")}</button>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[14px] font-semibold text-muted-foreground">{none ? t("onb7.qNone") : t(pick.kind === "own" ? "onb7.qNoteOwn" : pick.kind === "simple" ? "onb7.qNoteSimple" : "onb7.qNote")}</p>
    </Screen>
  );
};

// --- 4. what you'll discover over time ------------------------------------------------
const EXAMPLE_KEYS = new Set(["migraine", "sleep", "energy", "stress", "period", "quit", "move", "fights"]);
export const ValueV7 = ({ setup, pickKind, onBack, onStart, progress = [3, 5] }: { setup: V7Setup; pickKind: V7Pick["kind"]; onBack: () => void; onStart: (day: "today" | "yesterday" | "tonight") => void; progress?: [number, number] }) => {
  const { t } = useTranslation();
  const door = setup.doorId ? getDoor(setup.doorId) : null;
  const exKey = setup.doorId && EXAMPLE_KEYS.has(setup.doorId) && pickKind !== "simple" ? setup.doorId : pickKind === "own" ? "own" : door?.branch ?? "good";
  const daytime = new Date().getHours() < 17;
  const [ask, setAsk] = useState(false);
  const [day, setDay] = useState<"tonight" | "yesterday">("tonight");
  const row = (pic: React.ReactNode, title: string, line: string) => (
    <div className="surface flex items-center gap-3 rounded-[18px] px-3.5 py-3">
      <span className="flex h-[52px] w-[60px] shrink-0 items-center justify-center" aria-hidden="true">{pic}</span>
      <span className="min-w-0"><span className="block text-[16.5px] font-bold leading-tight">{title}</span><span className="mt-0.5 block text-[14px] font-semibold leading-snug text-muted-foreground">{line}</span></span>
    </div>
  );
  return (
    <Page>
      <Top onBack={onBack} step={progress[0]} steps={progress[1]} />
      <H1 className="mt-5 text-[27px]">{t("onb7.vTitle")}</H1>
      <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("onb7.vSub")}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {row(<span className="grid grid-cols-4 gap-1">{[1, 0, 0, 1, 0, 1, 0, 0].map((h, i) => <i key={i} className="block h-3 w-3 rounded-full" style={{ background: h ? "hsl(var(--strong))" : "hsl(var(--balanced))" }} />)}</span>, t("onb7.v1t"), t("onb7.v1l"))}
        {row(<span className="relative block h-12 w-[60px]"><Pic name="19_grassy_terraces" className="absolute bottom-0 left-0 w-[28px]" /><Pic name="09_waterfall" className="absolute bottom-1 right-0 w-[28px]" /><Spline className="absolute left-[20px] top-0 h-5 w-5 text-[hsl(var(--data-a))]" strokeWidth={2.6} /></span>, t("onb7.v2t"), t("onb7.v2l", { example: t(`onb7.example.${exKey}`) }))}
        {row(<Pic name="lighthouse" map className="w-[30px]" />, t("onb7.v3t"), t("onb7.v3l"))}
        {row(<Pic name="green_tree" map className="w-[40px]" />, t("onb7.v4t"), t("onb7.v4l"))}
      </div>
      <div className="min-h-6 flex-1" />
      <Main onClick={() => (daytime ? setAsk(true) : onStart("today"))}>{t("onb7.vStart")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></Main>
      {/* daytime: tonight, or yesterday (all answers for one day) */}
      {ask && (
        <div className="fixed inset-0 z-[120] flex items-end bg-[rgba(14,24,60,.35)] animate-fade-in" onClick={() => setAsk(false)}>
          <div className="w-full rounded-t-[28px] bg-white px-5 pb-safe pt-3 dark:bg-[hsl(var(--surface))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("onb7.dayAsk")}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/15" />
            <p className="text-[14px] font-bold text-[hsl(36_86%_45%)]">{t("onb7.dayTitle")}</p>
            <p className="mt-1 text-[22px] font-bold leading-tight">{t("onb7.dayAsk")}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Row on={day === "tonight"} onClick={() => setDay("tonight")} icon={<Moon className="h-5 w-5 shrink-0 text-[hsl(232_62%_62%)]" strokeWidth={2.2} />}>
                <span className="block">{t("onb7.dayTonight")}</span><span className="block text-[13px] font-semibold text-muted-foreground">{t("onb7.dayTonightLine")}</span>
              </Row>
              <Row on={day === "yesterday"} onClick={() => setDay("yesterday")} icon={<CalendarDays className="h-5 w-5 shrink-0 text-[hsl(36_86%_52%)]" strokeWidth={2.2} />}>
                <span className="block">{t("onb7.dayYesterday")}</span><span className="block text-[13px] font-semibold text-muted-foreground">{t("onb7.dayYesterdayLine")}</span>
              </Row>
            </div>
            <div className="h-4" />
            <Main onClick={() => { setAsk(false); onStart(day); }}>{t("doors.continue")}</Main>
          </div>
        </div>
      )}
    </Page>
  );
};
