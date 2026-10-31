// Onboarding in Malu's world ("Sticker Diary", 1.9). Built for people
// who hate reading: a title, big stickers to tap, one button.
//   language → doors (one or more, as Malu stickers) → for each door
//   "which days this week?" (tap the days; it fills the week at once)
//   → your week + what happens next → see you tonight
//   "Something else" → your own question → every evening → ready
//   "Just curious"   → an example → a one-week try
// No "context" questions here any more: they were answered for
// yesterday and asked again in the evening, which read as a bug.
import { useState } from "react";
import { HowSteps, WhyArt } from "./mw/Infographics";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { haptics } from "@/lib/haptics";
import { getNotificationSettings } from "@/lib/notifications";
import { localizeTrackerQuestionRaw } from "@/lib/trackerLocalize";
import { getTrackers, getEntries } from "@/lib/storage";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { lastDates } from "@/lib/weekMap";
import { Malu, MaluPose } from "./mw/Malu";
import { Glyph } from "./mw/Glyph";
import { TopicIcon, tapeVar, topicKind } from "./mw/TopicIcon";
import { WeekMap, tilt } from "./mw/WeekMap";
import { RECALL_KEY } from "./mw/TodayTop";
import {
  DOORS,
  Door,
  DoorId,
  addOwnTracker,
  ensureDoorTrackers,
  ensureTemplates,
  findTemplate,
  isoLocal,
  logDoorEntry,
  saveDoorState,
} from "@/lib/doors";

export type Finish = (opts: { path: "door" | "own" | "curious"; reminders: boolean }) => void;

/** Which Malu sticker stands for each door. */
export const DOOR_POSE: Record<DoorId, MaluPose> = {
  fights: "hmph",
  mood: "mood",
  migraine: "cloud",
  drinking: "glass",
  kid: "mom",
};

// Shared pieces --------------------------------------------------------

const Screen = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("min-h-full w-full max-w-md mx-auto flex flex-col px-5 pt-safe pb-safe animate-fade-in", className)}>
    {children}
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button type="button" onClick={onClick} disabled={disabled} data-onb-interactive className="mw-btn w-full mb-4">
    {children}
  </button>
);

const TopBar = ({ onBack, step, steps = 2 }: { onBack?: () => void; step?: number; steps?: number }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common.back")}
          data-onb-interactive
          className="h-11 w-11 rounded-full flex items-center justify-center active:bg-foreground/5"
        >
          <Glyph kind="back" size={24} />
        </button>
      ) : (
        <span className="w-11" />
      )}
      {step !== undefined && steps > 1 && (
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-[3px] transition-colors",
                i <= step ? "bg-[hsl(var(--mw-brand))]" : "bg-[hsl(var(--mw-grid))]",
              )}
              style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 8}deg)` }}
            />
          ))}
        </div>
      )}
      <span className="w-11" />
    </div>
  );
};

const Title = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h1 className={cn("mw-display text-[29px] leading-[1.15]", className)}>{children}</h1>
);

const Chip = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    data-onb-interactive
    style={{ touchAction: "manipulation" }}
    className="mw-chip"
  >
    {children}
  </button>
);

const Tick = ({ on }: { on: boolean }) => (
  <span
    className={cn(
      "h-[26px] w-[26px] shrink-0 rounded-[6px] flex items-center justify-center",
      on ? "bg-[hsl(var(--mw-brand))] text-[#2E2433]" : "shadow-[inset_0_0_0_2px_hsl(var(--mw-grid))]",
    )}
  >
    {on && <Glyph kind="check" size={18} strokeWidth={3} />}
  </span>
);

const ReminderRow = ({ on, setOn, label }: { on: boolean; setOn: (v: boolean) => void; label: string }) => {
  const { t } = useTranslation();
  return (
    <div className="mw-sheet w-full px-4 py-3 flex items-center gap-3">
      <TopicIcon kind="sleep" size={30} />
      <span className="flex-1 text-[17px] font-medium text-left">{label}</span>
      <Switch checked={on} onCheckedChange={setOn} aria-label={t("doors.reminderAria")} />
    </div>
  );
};

// Russian copy uses "сделал(а)" forms that genderPolish resolves from
// `memap_interview.pol`. Onboarding has no gender screen any more, so
// Russian users get one optional "он / она" row on the last screen.
const INTERVIEW_KEY = "memap_interview";
type AddressPol = "male" | "female";

const readPol = (): AddressPol | undefined => {
  try {
    const pol = JSON.parse(localStorage.getItem(INTERVIEW_KEY) || "{}")?.pol;
    return pol === "male" || pol === "female" ? pol : undefined;
  } catch {
    return undefined;
  }
};

const writePol = (pol: AddressPol): void => {
  try {
    const prev = JSON.parse(localStorage.getItem(INTERVIEW_KEY) || "{}");
    localStorage.setItem(INTERVIEW_KEY, JSON.stringify({ ...prev, pol }));
    window.dispatchEvent(new Event("memap-pol-changed"));
  } catch {
    // Brackets stay visible; nothing breaks.
  }
};

/** Optional "Как к тебе обращаться? Он / Она" row. Russian only. */
export const AddressPolRow = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const [pol, setPol] = useState<AddressPol | undefined>(readPol);
  if (getLanguage() !== "ru") return null;
  return (
    <div className={cn("mw-sheet w-full px-4 py-2.5 flex items-center gap-2", className)}>
      <span className="flex-1 text-[17px] font-medium text-left">{t("doors.polTitle")}</span>
      {(["male", "female"] as const).map((p) => (
        <Chip
          key={p}
          selected={pol === p}
          onClick={() => {
            setPol(p);
            writePol(p);
          }}
        >
          {p === "male" ? t("doors.polHe") : t("doors.polShe")}
        </Chip>
      ))}
    </div>
  );
};

// The last screen of every path: Malu, one line, the reminder, Go.
const DoneScreen = ({
  title,
  pose = "sleepy",
  onDone,
}: {
  title: string;
  pose?: MaluPose;
  onDone: (reminders: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState(true);
  const time = getNotificationSettings().time;
  return (
    <Screen className="items-center text-center">
      <div className="flex-1 min-h-6" />
      <Malu pose={pose} size={190} bob className="-mb-2" />
      <h1 className="mw-display text-[38px] leading-[1.1]">{title}</h1>
      <div className="flex-1 min-h-6" />
      <AddressPolRow className="mb-3" />
      <ReminderRow on={reminders} setOn={setReminders} label={t("doors.remindShort", { time })} />
      <div className="h-5" />
      <PrimaryButton onClick={() => onDone(reminders)}>{t("doors.goToday")}</PrimaryButton>
    </Screen>
  );
};

// Why (before the doors): memory says "every day", the page says 5 of 30.
export const WhyScreen = ({ onNext }: { onNext: () => void }) => {
  const { t } = useTranslation();
  return (
    <Screen>
      <div className="mt-6 flex items-end gap-2">
        <Malu pose="think" size={96} className="shrink-0 -ml-1" />
        <Title className="pb-4">{t("mw.why.title")}</Title>
      </div>
      <div className="mt-4">
        <WhyArt />
      </div>
      <p className="mt-5 text-[19px] font-medium leading-snug mw-drop" style={{ animationDelay: "2600ms" }}>
        {t("mw.why.line")}
      </p>
      <div className="flex-1 min-h-6" />
      <PrimaryButton onClick={onNext}>{t("doors.next")}</PrimaryButton>
    </Screen>
  );
};

// Doors --------------------------------------------------------------

export type PickResult = { kind: "doors"; ids: DoorId[] } | { kind: "own" } | { kind: "curious" };

export const DoorPickerScreen = ({ onPick }: { onPick: (r: PickResult) => void }) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<DoorId[]>([]);
  const [alt, setAlt] = useState<"own" | "curious" | null>(null);

  const toggle = (id: DoorId) => {
    setAlt(null);
    haptics.tap();
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const pickAlt = (a: "own" | "curious") => {
    setPicked([]);
    setAlt((prev) => (prev === a ? null : a));
  };

  const go = () => {
    if (alt) {
      track("door_selected", { door: alt });
      onPick({ kind: alt });
      return;
    }
    if (picked.length === 0) return;
    picked.forEach((d) => track("door_selected", { door: d, count: picked.length }));
    // The first one tapped is the main door; every door gets the same
    // "which days this week?" screen, so there's no "which first?" step.
    onPick({ kind: "doors", ids: picked });
  };

  return (
    <Screen>
      <Title className="mt-8">{t("doors.pickTitle")}</Title>
      <p className="mt-1.5 text-[18px] text-muted-foreground">{t("doors.pickSubtitle")}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {DOORS.map((door, i) => {
          const on = picked.includes(door.id);
          const wide = i === DOORS.length - 1 && DOORS.length % 2 === 1;
          return (
            <button
              key={door.id}
              type="button"
              onClick={() => toggle(door.id)}
              aria-pressed={on}
              data-onb-interactive
              style={{ touchAction: "manipulation", ["--tape" as string]: tapeVar(topicKind("", door.id)) }}
              className={cn(
                "mw-choice relative !p-2.5",
                wide ? "col-span-2 h-[100px] !gap-2" : "flex-col !items-center !justify-end h-[150px] !gap-1 text-center",
              )}
            >
              <Malu pose={DOOR_POSE[door.id]} size={wide ? 76 : 86} tappable={false} />
              <span className={cn("leading-tight text-[17px]", wide && "flex-1 text-left text-[18px]")}>{t(`doors.${door.id}.name`)}</span>
              {on && (
                <span className="absolute right-2 top-2 h-7 w-7 rounded-full bg-white text-[#2E2433] flex items-center justify-center shadow-[0_2px_6px_-2px_rgb(46_36_51/0.5)]">
                  <Glyph kind="check" size={18} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-3">
        {(["own", "curious"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => pickAlt(a)}
            aria-pressed={alt === a}
            data-onb-interactive
            className="mw-choice flex-1 !justify-center !text-[17px] min-h-[56px]"
          >
            {t(a === "own" ? "doors.own.name" : "doors.curious.name")}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-6" />
      <PrimaryButton disabled={!alt && picked.length === 0} onClick={go}>
        {t("doors.continue")}
      </PrimaryButton>
    </Screen>
  );
};

// Door flow: tap the days this week -----------------------------------

export const DoorFlow = ({
  doors,
  onBack,
  onFinish,
}: {
  /** Main door first; any others were ticked at the same time. */
  doors: Door[];
  onBack: () => void;
  onFinish: Finish;
}) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [main, ...extras] = doors;
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<"how" | "week" | "reveal" | "done">("how");
  const [days, setDays] = useState<Record<string, string[]>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ trackers: Tracker[]; entries: TrackerEntry[] } | null>(null);
  const [dates] = useState(() => lastDates(new Date(), 7));
  const today = dates[dates.length - 1];

  const door = doors[i];
  const sel = days[door.id] ?? [];
  const kind = topicKind("", door.id);

  const toggleDay = (d: string) => {
    haptics.tap();
    setDays((prev) => {
      const cur = prev[door.id] ?? [];
      return { ...prev, [door.id]: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] };
    });
  };
  const toggleTag = (id: string) =>
    setTags((prev) => {
      const cur = prev[door.id] ?? [];
      return { ...prev, [door.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  const commit = async (skip: Record<string, boolean>) => {
    if (saving) return;
    setSaving(true);
    try {
      // One after another: each call reads and rewrites the whole tracker
      // list, so running them in parallel kept only the last door's.
      const ensured: Awaited<ReturnType<typeof ensureDoorTrackers>>[] = [];
      for (const d of doors) ensured.push(await ensureDoorTrackers(d));
      saveDoorState({
        id: main.id,
        trackerId: ensured[0].trackerId,
        contextTrackerIds: ensured[0].contextTrackerIds,
        startedAt: isoLocal(new Date()),
        extra: extras.map((d, k) => ({ id: d.id, trackerId: ensured[k + 1].trackerId })),
      });
      let any = false;
      for (let k = 0; k < doors.length; k++) {
        const d = doors[k];
        if (skip[d.id]) continue;
        any = true;
        const hit = days[d.id] ?? [];
        const latest = [...hit].sort().pop();
        for (const date of dates) {
          const yes = hit.includes(date);
          // Tonight's answer comes in the evening; only a "yes" today is
          // written now.
          if (!yes && date === today) continue;
          await logDoorEntry({
            trackerId: ensured[k].trackerId,
            date,
            value: yes,
            tags: yes && date === latest ? tags[d.id] ?? [] : [],
          });
        }
        track("first_entry_logged", {
          door: d.id,
          doors: doors.length,
          days: hit.length,
          reasons: (tags[d.id] ?? []).length,
        });
      }
      if (any) localStorage.setItem(RECALL_KEY, "true");
      setSaved({ trackers: await getTrackers(), entries: await getEntries() });
    } catch (err) {
      console.error("[DoorFlow] commit failed:", err);
    } finally {
      setSaving(false);
      setStage("reveal");
    }
  };

  const next = (skip: boolean) => {
    const nextSkip = { ...skipped, [door.id]: skip };
    setSkipped(nextSkip);
    if (i < doors.length - 1) setI(i + 1);
    else void commit(nextSkip);
  };

  if (stage === "how") {
    return (
      <Screen>
        <TopBar onBack={onBack} step={0} steps={doors.length + 2} />
        <Title className="mt-3">{t("mw.how.title")}</Title>
        <div className="mt-4">
          <HowSteps door={main.id} />
        </div>
        <div className="h-5" />
        <div className="sticky bottom-0 -mx-5 px-5 pt-4 bg-gradient-to-t from-background from-70% to-transparent">
          <PrimaryButton onClick={() => setStage("week")}>{t("mw.how.go")}</PrimaryButton>
        </div>
      </Screen>
    );
  }

  if (stage === "week") {
    return (
      <Screen key={door.id}>
        <TopBar onBack={i > 0 ? () => setI(i - 1) : () => setStage("how")} step={i + 1} steps={doors.length + 2} />
        <div className="mt-1 flex justify-center">
          <Malu pose={DOOR_POSE[door.id]} size={104} />
        </div>
        <Title className="mt-1 text-center">{t(`mw.onb.weekTitle.${door.id}`)}</Title>
        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {dates.map((d) => {
            const on = sel.includes(d);
            const day = new Date(d + "T12:00:00");
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={on}
                data-mood={on ? "bad" : undefined}
                data-onb-interactive
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "mw-cell !aspect-[5/6] flex-col !justify-start pt-2.5 !text-foreground",
                  d === today && "!shadow-[inset_0_0_0_2px_hsl(var(--mw-brand))]",
                )}
              >
                <span className="text-[15px] font-semibold text-muted-foreground leading-none">
                  {d === today ? t("mw.onb.today") : format(day, "EEEEEE", { locale: dateLocale })}
                </span>
                <span className="mt-1 text-[22px] font-semibold leading-none tabular-nums">{format(day, "d")}</span>
                {on && (
                  <TopicIcon
                    kind={kind}
                    size={44}
                    sticker
                    className="absolute -bottom-1.5 -right-1 mw-slap"
                    style={{ ["--r" as string]: `${tilt(d)}deg`, transform: `rotate(${tilt(d)}deg)` }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {door.kind === "event" && sel.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="mt-7 mw-display text-[21px]">{t(`doors.${door.id}.reasonsTitle`)}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {door.reasons.map((r) => (
                <Chip key={r} selected={(tags[door.id] ?? []).includes(r)} onClick={() => toggleTag(r)}>
                  {t(`doors.reasons.${r}`)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-6" />
        {/* Stays in reach when the reason chips push the page down. */}
        <div className="sticky bottom-0 -mx-5 px-5 pt-4 flex flex-col bg-gradient-to-t from-background from-70% to-transparent">
          <PrimaryButton disabled={saving} onClick={() => next(false)}>
            {sel.length > 0 ? t("doors.next") : t(`mw.onb.none.${door.id}`)}
          </PrimaryButton>
          <button type="button" onClick={() => next(true)} disabled={saving} className="mw-link self-center -mt-1 mb-3">
            {t("mw.onb.dontRemember")}
          </button>
        </div>
      </Screen>
    );
  }

  if (stage === "reveal") {
    const anyHit = Object.values(days).some((x) => x.length > 0);
    const allSkipped = doors.every((d) => skipped[d.id]);
    return (
      <Screen>
        <TopBar step={doors.length + 1} steps={doors.length + 2} />
        <div className="mt-1 flex items-end gap-2">
          <Malu pose={anyHit ? "hug" : allSkipped ? "wave" : "cheer"} size={anyHit ? 84 : 100} className="shrink-0 -ml-1" />
          <p className="mw-bubble mb-7 text-[18px] leading-snug">
            {allSkipped ? t("mw.onb.revealStart") : anyHit ? t("mw.onb.revealHard") : t("mw.onb.revealCalm")}
          </p>
        </div>
        <Title className="mt-3">{t("mw.onb.revealTitle")}</Title>
        {saved && (
          <div className="mw-sheet mt-4 px-3 pt-2 pb-3.5">
            <WeekMap trackers={saved.trackers} entries={saved.entries} dates={dates} onlyDoors animate maxRows={5} />
          </div>
        )}
        <h2 className="mt-7 mw-display text-[22px]">{t("mw.onb.nextTitle")}</h2>
        <ol className="mt-3 flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <TopicIcon kind="sleep" size={40} sticker />
            <span className="text-[18px] font-medium leading-snug">{t("mw.onb.step1")}</span>
          </li>
          <li className="flex items-center gap-3">
            <TopicIcon kind={topicKind("", main.id)} size={40} sticker style={{ transform: "rotate(-6deg)" }} />
            <span className="text-[18px] font-medium leading-snug">{t("mw.onb.step2")}</span>
          </li>
          <li className="flex items-center gap-3">
            <Malu pose="wink" size={42} tappable={false} />
            <span className="text-[18px] font-medium leading-snug">{t("mw.onb.step3")}</span>
          </li>
        </ol>
        <div className="flex-1 min-h-8" />
        <PrimaryButton onClick={() => setStage("done")}>{t("doors.next")}</PrimaryButton>
      </Screen>
    );
  }

  return <DoneScreen title={t("mw.onb.doneTitle")} onDone={(reminders) => onFinish({ path: "door", reminders })} />;
};

// "Something else": your own question -----------------------------------

// Ready questions offered next to your own, by library template id.
const OWN_PICKS: { key: string; template: string }[] = [
  { key: "period", template: "period-symptoms" },
  { key: "sleep", template: "slept-enough" },
  { key: "workStress", template: "burned-out-after-work" },
  { key: "crying", template: "cried-today" },
  { key: "pet", template: "pet-low-energy" },
  { key: "family", template: "called-parent" },
  { key: "spending", template: "impulse-spending" },
  { key: "screens", template: "screen-time-long" },
  { key: "exercise", template: "exercised" },
];
const OWN_MAYBE = ["slept-enough", "felt-anxious"];

const questionOf = (templateId: string) => {
  const found = findTemplate(templateId);
  return found ? localizeTrackerQuestionRaw(found.template.questionText) : templateId;
};

export const OwnFlow = ({ onBack, onFinish }: { onBack: () => void; onFinish: Finish }) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"ask" | "list" | "done">("ask");
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const [own, setOwn] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [maybe, setMaybe] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const togglePick = (tpl: string) => setPicks((p) => (p.includes(tpl) ? p.filter((x) => x !== tpl) : [...p, tpl]));
  const maybeIds = OWN_MAYBE.filter((id) => !picks.includes(id));
  const count = (own && text.trim() ? 1 : 0) + chosen.length + maybe.length;

  if (stage === "ask") {
    return (
      <Screen>
        <TopBar onBack={onBack} step={0} />
        <Title className="mt-6">{t("doors.own.title")}</Title>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("doors.own.placeholder")}
          aria-label={t("doors.own.title")}
          className="mt-5 w-full rounded-[14px] bg-white shadow-[0_0_0_2px_hsl(var(--mw-brand))] px-4 py-4 text-[19px] text-[#2E2433] placeholder:text-muted-foreground outline-none"
        />
        <h2 className="mt-7 mw-display text-[21px]">{t("doors.own.orPick")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {OWN_PICKS.map((p) => (
            <Chip key={p.key} selected={picks.includes(p.template)} onClick={() => togglePick(p.template)}>
              {t(`doors.ownPick.${p.key}`)}
            </Chip>
          ))}
        </div>
        <div className="flex-1 min-h-6" />
        <PrimaryButton
          disabled={!text.trim() && picks.length === 0}
          onClick={() => {
            setOwn(true);
            setChosen(picks);
            setMaybe([]);
            setStage("list");
          }}
        >
          {t("doors.next")}
        </PrimaryButton>
      </Screen>
    );
  }

  if (stage === "list") {
    const row = (key: string, label: React.ReactNode, on: boolean, onToggle: () => void) => (
      <button
        key={key}
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        data-onb-interactive
        className="w-full flex items-center gap-3.5 px-4 py-4 text-left"
      >
        <Tick on={on} />
        <span className={cn("text-[17px] leading-snug", !on && "text-muted-foreground")}>{label}</span>
      </button>
    );
    return (
      <Screen>
        <TopBar onBack={() => setStage("ask")} step={1} />
        <Title className="mt-6">{t("doors.own.listTitle")}</Title>
        <div className="mw-sheet mt-5 divide-y divide-[hsl(var(--mw-grid))]">
          {text.trim() &&
            row(
              "own",
              <span className="flex flex-col gap-1">
                <span className="mw-hand self-start text-[16px] text-muted-foreground">
                  {t("doors.own.yours")}
                </span>
                {text.trim()}
              </span>,
              own,
              () => setOwn((v) => !v),
            )}
          {picks.map((tpl) =>
            row(tpl, questionOf(tpl), chosen.includes(tpl), () =>
              setChosen((c) => (c.includes(tpl) ? c.filter((x) => x !== tpl) : [...c, tpl])),
            ),
          )}
        </div>
        {maybeIds.length > 0 && (
          <>
            <h2 className="mt-6 px-1 mw-display text-[20px]">{t("doors.own.maybeAlso")}</h2>
            <div className="mw-sheet mt-2.5 divide-y divide-[hsl(var(--mw-grid))]">
              {maybeIds.map((tpl) =>
                row(tpl, questionOf(tpl), maybe.includes(tpl), () =>
                  setMaybe((m) => (m.includes(tpl) ? m.filter((x) => x !== tpl) : [...m, tpl])),
                ),
              )}
            </div>
          </>
        )}
        <div className="flex-1 min-h-6" />
        <PrimaryButton
          disabled={count === 0 || saving}
          onClick={async () => {
            setSaving(true);
            try {
              if (own && text.trim()) await addOwnTracker(text);
              const templates = [...chosen, ...maybe];
              if (templates.length) await ensureTemplates(templates);
              track("first_entry_logged", { door: "own", own: own && !!text.trim(), templates: templates.length });
            } catch (err) {
              console.error("[OwnFlow] save failed:", err);
            } finally {
              setSaving(false);
              setStage("done");
            }
          }}
        >
          {t("doors.own.start", { count })}
        </PrimaryButton>
      </Screen>
    );
  }

  return <DoneScreen title={t("mw.onb.doneTitle")} onDone={(reminders) => onFinish({ path: "own", reminders })} />;
};

// "Just curious": an example, then a one-week try --------------------------

const TRIAL_TEMPLATES = ["slept-enough", "felt-happy", "had-energy"];
const EXAMPLE_A = [2, 5, 6, 9, 12, 13];
const EXAMPLE_B = [3, 6, 7, 10, 13];

export const CuriousFlow = ({ onBack, onFinish }: { onBack: () => void; onFinish: Finish }) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"example" | "week">("example");
  const [reminders, setReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  const time = getNotificationSettings().time;

  if (stage === "example") {
    const strip = (on: number[], cls: string) => (
      <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className={cn("aspect-square rounded-[4px]", on.includes(i + 1) ? cls : "shadow-[inset_0_0_0_1px_hsl(var(--mw-grid))]")} />
        ))}
      </div>
    );
    return (
      <Screen>
        <TopBar onBack={onBack} />
        <Title className="mt-6">{t("doors.curious.exampleTitle")}</Title>
        <div className="mw-taped mt-8 p-[18px]">
          <div className="flex items-center justify-between">
            <span className="mw-hand text-[17px] text-muted-foreground">{t("doors.curious.found")}</span>
            <span className="mw-hand text-[17px] text-muted-foreground">{t("doors.exampleBadge")}</span>
          </div>
          <p className="mt-2 mw-display text-[22px] leading-tight">{t("doors.curious.sentence")}</p>
          <p className="mt-3 mb-1.5 text-[15px] font-semibold text-muted-foreground">{t("doors.curious.shortNight")}</p>
          {strip(EXAMPLE_A, "bg-[hsl(var(--tape-migraine))]")}
          <p className="mt-2.5 mb-1.5 text-[15px] font-semibold text-muted-foreground">{t("doors.curious.lowMood")}</p>
          {strip(EXAMPLE_B, "bg-[hsl(var(--tape-mood))]")}
          <span className="mt-3.5 inline-flex items-center text-[16px] font-semibold text-muted-foreground">
            {t("patterns.findHolds", { k: 5, n: 6 })}
          </span>
        </div>
        <div className="flex-1 min-h-6" />
        <PrimaryButton onClick={() => setStage("week")}>{t("doors.curious.tryWeek")}</PrimaryButton>
      </Screen>
    );
  }

  return (
    <Screen className="text-center">
      <TopBar onBack={() => setStage("example")} />
      <div className="mt-1 flex justify-center">
        <Malu pose="happy" size={120} className="-mt-3 -mb-3" />
      </div>
      <Title className="mt-2">{t("doors.curious.weekTitle")}</Title>
      <p className="mt-2.5 text-[18px] text-muted-foreground">{t("doors.curious.weekSub")}</p>
      <div className="mw-sheet mt-5 divide-y divide-[hsl(var(--mw-grid))] text-left">
        {TRIAL_TEMPLATES.map((tpl) => (
          <div key={tpl} className="flex items-center gap-3.5 px-4 py-4">
            <Tick on />
            <span className="text-[17px] leading-snug">{questionOf(tpl)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-10 rounded-[6px] flex items-center justify-center text-[15px] font-semibold",
              i === 6 ? "shadow-[inset_0_0_0_2px_hsl(var(--mw-brand))]" : "shadow-[inset_0_0_0_1px_hsl(var(--mw-grid))] text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <div className="flex-1 min-h-6" />
      <AddressPolRow className="mb-3" />
      <ReminderRow on={reminders} setOn={setReminders} label={t("doors.remindShort", { time })} />
      <div className="h-3.5" />
      <PrimaryButton
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await ensureTemplates(TRIAL_TEMPLATES);
            localStorage.setItem("memap_trial_started", isoLocal(new Date()));
            track("first_entry_logged", { door: "curious" });
          } catch (err) {
            console.error("[CuriousFlow] save failed:", err);
          } finally {
            setSaving(false);
            onFinish({ path: "curious", reminders });
          }
        }}
      >
        {t("doors.curious.startWeek")}
      </PrimaryButton>
    </Screen>
  );
};
