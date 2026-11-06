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
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, Clock, Globe, LayoutGrid, Lock, Moon, Pencil, Plus, Spline, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n";
import { avatarUrl, DEFAULT_AVATAR, getAvatar } from "@/lib/avatar";
import { art } from "@/lib/globeArt";
import { islandName, islandOf, mapPicFor, type IslandId } from "@/lib/islands";
import { addOwnTracker, ensureTemplates, findTemplate, getDoor, isoLocal, saveDoorState, type Door, type DoorId } from "@/lib/doors";
import { asQuestion, templateQuestion } from "@/lib/cardText";
import { getTrackers, saveTrackers } from "@/lib/storage";
import type { Tracker } from "@/types/tracker";

export type V7Pick = { kind: "door"; id: DoorId } | { kind: "simple" } | { kind: "own"; text: string };
/** What the setup made: the questions for the first check-in. */
export interface V7Setup { ids: string[]; mainId: string; doorId: DoorId | null }

// --- pieces ----------------------------------------------------------------------
const Page = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-safe pt-safe animate-fade-in", className)}>{children}</div>
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
      {/* the world as the picture: islands, a dotted line, the boat */}
      <div className="relative mx-auto mt-2 h-[270px] w-full max-w-[360px]" aria-hidden="true">
        <Pic name="11_sakura" className="onb-float absolute left-0 top-[4%] w-[40%]" />
        <Pic name="09_waterfall" className="onb-float absolute right-[2%] top-0 w-[38%]" style={{ animationDelay: "-1.4s" }} />
        <Pic name="17_lavender_garden" className="onb-float absolute bottom-[8%] right-[6%] w-[30%]" style={{ animationDelay: "-2.6s" }} />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 270">
          {Array.from({ length: 12 }, (_, i) => { const u = (i + 0.5) / 12, x = 140 + u * 80, y = 60 - Math.sin(u * Math.PI) * 44 + u * 6; const e = Math.min(1, Math.min(u, 1 - u) / 0.2); return <circle key={i} cx={x} cy={y} r={2 + 1.6 * e} className="planet-route" opacity={0.4 + 0.6 * e} />; })}
        </svg>
        <span className="onb-bob absolute bottom-0 left-[24%] block w-[30%]">
          <Pic name="sailboat" map />
          {who && <img src={who} alt="" className="absolute left-[46%] top-[38%] w-[42%]" />}
        </span>
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

// --- 2. one topic ------------------------------------------------------------------
const FIRST: DoorId[] = ["migraine", "sleep", "energy", "period", "stress"];
const MORE: { sec: string; ids: DoorId[] }[] = [
  { sec: "onb7.secGood", ids: ["goodSleep", "calm", "focus", "closeness", "movement", "joy"] },
  { sec: "onb7.secRelations", ids: ["fights"] },
  { sec: "onb7.secKids", ids: ["kid"] },
  { sec: "onb7.secHabits", ids: ["drinking", "mood"] },
  { sec: "onb7.secThought", ids: ["quit", "move"] },
];
export const TopicV7 = ({ onBack, onPick, onOwn, initial }: { onBack: () => void; onPick: (id: DoorId) => void; onOwn: () => void; initial?: DoorId | null }) => {
  const { t } = useTranslation();
  const [sel, setSel] = useState<DoorId | null>(initial ?? null);
  const [more, setMore] = useState(!!initial && !FIRST.includes(initial));
  const name = (id: DoorId) => t(id === "energy" ? "onb7.lowEnergy" : `doors.${id}.name`);
  return (
    <Page>
      <Top onBack={onBack} step={0} />
      <H1 className="mt-5">{t("onb7.topicTitle")}</H1>
      <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("onb7.topicSub")}</p>
      <div className="mt-4 flex flex-col gap-2">
        {FIRST.map((id) => { const d = getDoor(id)!; return <Row key={id} on={sel === id} onClick={() => setSel(id)} icon={<Dot door={d} />}>{name(id)}</Row>; })}
        <button type="button" onClick={() => { haptics.tap(); setMore((v) => !v); }} aria-expanded={more} data-onb-interactive
          className="surface flex min-h-[52px] w-full items-center gap-3 rounded-[18px] px-4 text-left text-[17px] font-bold">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]"><LayoutGrid className="h-5 w-5 text-muted-foreground" strokeWidth={2.2} /></span>
          <span className="flex-1">{t("onb7.moreTopics")}</span>
          {more ? <ChevronUp className="h-5 w-5 text-muted-foreground" strokeWidth={2.4} /> : <ChevronDown className="h-5 w-5 text-muted-foreground" strokeWidth={2.4} />}
        </button>
        {more && (
          <div className="surface rounded-[18px] px-4 pb-2 pt-1 animate-fade-in">
            {MORE.map((g) => (
              <div key={g.sec}>
                <p className="pt-3 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t(g.sec)}</p>
                {g.ids.map((id) => (
                  <button key={id} type="button" onClick={() => { haptics.tap(); setSel(id); }} aria-pressed={sel === id} data-onb-interactive
                    className="flex min-h-[44px] w-full items-center justify-between border-b border-foreground/[0.06] text-left text-[16px] font-bold last:border-0">
                    {t(`doors.${id}.name`)}
                    {sel === id && <span className="tick is-on" aria-hidden="true"><Check className="h-4 w-4" strokeWidth={3} /></span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <Row on={false} onClick={onOwn} icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-teal)/0.12)]"><Pencil className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} /></span>}>{t("onb7.writeOwn")}</Row>
      </div>
      <div className="min-h-6 flex-1" />
      <Main disabled={!sel} onClick={() => { if (sel) { track("door_selected", { door: sel }); onPick(sel); } }}>{t("doors.continue")}</Main>
    </Page>
  );
};

// --- 2b. your own question -----------------------------------------------------------
const IDEAS = ["onb7.idea1", "onb7.idea2", "onb7.idea3", "onb7.idea4"];
export const OwnV7 = ({ onBack, onDone }: { onBack: () => void; onDone: (text: string) => void }) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const ok = text.trim().length >= 4;
  return (
    <Page>
      <Top onBack={onBack} step={0} />
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

export const QuestionsV7 = ({ pick, onBack, onDone }: { pick: V7Pick; onBack: () => void; onDone: (s: V7Setup) => void }) => {
  const { t } = useTranslation();
  const door = pick.kind === "door" ? getDoor(pick.id) ?? null : null;
  const mainTpl = pick.kind === "door" ? door!.mainTemplateId : pick.kind === "simple" ? SIMPLE.main : null;
  const aroundTpls = useMemo(() => {
    if (pick.kind === "door" && door) { const x = EXTRA[door.id]; return [...door.contextTemplateIds, ...(x && !door.contextTemplateIds.includes(x) ? [x] : [])]; }
    return pick.kind === "simple" ? SIMPLE.around : OWN_AROUND;
  }, [pick, door]);
  const baseMain = mainTpl ? qOf(mainTpl) : pick.kind === "own" ? pick.text : "";
  const [mainText, setMainText] = useState(baseMain);
  const [editing, setEditing] = useState(false);
  const [on, setOn] = useState<Set<string>>(() => new Set(pick.kind === "door" && door ? door.contextTemplateIds : aroundTpls));
  const [own, setOwn] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const neutral = door?.branch === "thought";
  const isl = (id: string) => islandName(t, islandOfTpl(id));
  const mainIsle = mainTpl ? isl(mainTpl) : islandName(t, "mine" as IslandId);
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const none = on.size === 0 && own.length === 0;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const mainId = mainTpl ? (await ensureTemplates([mainTpl]))[0] : await addOwnTracker(mainText);
      const aroundIds = await ensureTemplates(aroundTpls.filter((id) => on.has(id)));
      const ownIds: string[] = [];
      for (const q of own) ownIds.push(await addOwnTracker(q));
      // her own words for the main question (cardQuestion shows hers)
      if (mainTpl && mainText.trim() && mainText.trim() !== baseMain) {
        const all = await getTrackers();
        await saveTrackers(all.map((x) => (x.id === mainId ? { ...x, questionText: asQuestion(mainText) } : x)));
      }
      const doorId: DoorId | null = pick.kind === "door" ? pick.id : pick.kind === "simple" ? "energy" : null;
      if (doorId) saveDoorState({ id: doorId, trackerId: mainId, contextTrackerIds: [...aroundIds, ...ownIds], startedAt: isoLocal(new Date()), extra: [] });
      track("onboarding_questions", { topic: doorId ?? "own", around: aroundIds.length + ownIds.length, edited: mainText.trim() !== baseMain });
      onDone({ ids: [mainId, ...aroundIds, ...ownIds], mainId, doorId });
    } finally { setBusy(false); }
  };

  return (
    <Page>
      <Top onBack={onBack} step={1} />
      <H1 className="mt-5">{t("onb7.qTitle")}</H1>
      <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("onb7.qSub")}</p>
      {/* the main question */}
      <div className="surface pick-on mt-4 rounded-[20px] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            <i className={cn("block h-2.5 w-2.5 rounded-full", neutral ? "bg-[hsl(var(--data-a))]" : "bg-[hsl(var(--coin-teal))]")} />{mainIsle} · {t("onb7.qMain")}
          </span>
          {!editing && <button type="button" onClick={() => { haptics.tap(); setEditing(true); }} data-onb-interactive className="flex items-center gap-1 text-[14px] font-bold text-[hsl(var(--coin-teal))]"><Pencil className="h-3.5 w-3.5" strokeWidth={2.6} />{t("onb7.qEdit")}</button>}
        </div>
        {editing ? (
          <div className="mt-2 flex gap-2">
            <input autoFocus value={mainText} onChange={(e) => setMainText(e.target.value.slice(0, 80))} aria-label={t("onb7.qMain")} data-onb-interactive
              className="h-11 min-w-0 flex-1 rounded-[12px] bg-foreground/[0.05] px-3 text-[17px] font-bold outline-none" />
            <button type="button" onClick={() => { haptics.tap(); setEditing(false); if (!mainText.trim()) setMainText(baseMain); }} data-onb-interactive className="h-11 rounded-[12px] px-3 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("onb7.qDone")}</button>
          </div>
        ) : <p className="mt-1.5 text-[20px] font-bold leading-snug">{mainText}</p>}
        <p className="mt-1 text-[14px] font-semibold text-muted-foreground">{neutral ? t("onb7.qNeutral") : t("onb7.qMainLine")}</p>
      </div>
      {/* the ones around it */}
      <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("onb7.qAlso")}</p>
      <div className="mt-2 flex flex-col gap-2">
        {aroundTpls.map((id) => (
          <Row key={id} on={on.has(id)} onClick={() => toggle(id)} className="text-[16px]"
            icon={<span className="w-[64px] shrink-0 truncate text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{isl(id)}</span>}>{qOf(id)}</Row>
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
      <div className="min-h-6 flex-1" />
      <Main disabled={busy || editing} onClick={() => void save()}>{t("doors.continue")}</Main>
    </Page>
  );
};

// --- 4. what you'll discover over time ------------------------------------------------
const EXAMPLE_KEYS = new Set(["migraine", "sleep", "energy", "stress", "period", "quit", "move", "fights"]);
export const ValueV7 = ({ setup, pickKind, onBack, onStart }: { setup: V7Setup; pickKind: V7Pick["kind"]; onBack: () => void; onStart: (day: "today" | "yesterday" | "tonight") => void }) => {
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
      <Top onBack={onBack} step={2} />
      <H1 className="mt-5 text-[27px]">{t("onb7.vTitle")}</H1>
      <p className="mt-1.5 text-[16px] font-semibold text-muted-foreground">{t("onb7.vSub")}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {row(<span className="grid grid-cols-4 gap-1">{[1, 0, 0, 1, 0, 1, 0, 0].map((h, i) => <i key={i} className="block h-3 w-3 rounded-full" style={{ background: h ? "hsl(var(--strong))" : "hsl(var(--balanced))" }} />)}</span>, t("onb7.v1t"), t("onb7.v1l"))}
        {row(<span className="relative block h-12 w-[60px]"><Pic name="19_grassy_terraces" className="absolute bottom-0 left-0 w-[28px]" /><Pic name="09_waterfall" className="absolute bottom-1 right-0 w-[28px]" /><Spline className="absolute left-[20px] top-0 h-5 w-5 text-[hsl(var(--data-a))]" strokeWidth={2.6} /></span>, t("onb7.v2t"), t("onb7.v2l", { example: t(`onb7.example.${exKey}`) }))}
        {row(<Pic name="lighthouse" map className="w-[30px]" />, t("onb7.v3t"), t("onb7.v3l"))}
        {row(<Pic name="green_tree" map className="w-[40px]" />, t("onb7.v4t"), t("onb7.v4l"))}
      </div>
      <p className="mt-3 text-center text-[14px] font-bold text-muted-foreground">{t("onb7.vNote")}</p>
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
