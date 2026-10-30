// 1.8.0 onboarding (canvas "MeMap: новая версия", page 11). Built for
// people who hate reading: a title, big options, one button. No small
// grey explanations.
//   doors (one or more) → [which one first?] → when + why (or "how did
//   today feel?" for mood) → around it → logged
//   "Something else" → your own question → every evening → ready
//   "Just curious"   → an example finding → a one-week try
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ArrowLeft, Bell, Check, Smile, Meh, Frown, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { getNotificationSettings } from "@/lib/notifications";
import { localizeTrackerQuestionRaw } from "@/lib/trackerLocalize";
import maluWave from "@/assets/malu/malu-wave.webp";
import maluHappy from "@/assets/malu/malu-happy.webp";
import {
  DOORS,
  Door,
  DoorId,
  FEELINGS,
  Feeling,
  addOwnTracker,
  contextFor,
  daysAgoIso,
  ensureDoorTrackers,
  ensureTemplates,
  feelingAnswers,
  findTemplate,
  isoLocal,
  logDoorEntry,
  saveDoorState,
} from "@/lib/doors";

export type Finish = (opts: { path: "door" | "own" | "curious"; reminders: boolean }) => void;

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
  <Button
    onClick={onClick}
    disabled={disabled}
    data-onb-interactive
    className="w-full h-[56px] rounded-full text-[17px] font-semibold mb-5"
  >
    {children}
  </Button>
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
          className="h-11 w-11 rounded-full bg-foreground/[0.08] flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
      ) : (
        <span className="w-11" />
      )}
      {step !== undefined && (
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={cn("h-2 rounded-full transition-all", i === step ? "w-[22px] bg-primary" : "w-2 bg-foreground/25")}
            />
          ))}
        </div>
      )}
      <span className="w-11" />
    </div>
  );
};

const Title = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h1 className={cn("text-[30px] leading-[1.12] font-bold tracking-tight", className)}>{children}</h1>
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
    className={cn(
      "inline-flex items-center h-11 px-[18px] rounded-full border text-[17px] transition-colors",
      selected
        ? "border-primary bg-primary/15 text-primary font-semibold"
        : "border-foreground/[0.18] bg-foreground/[0.05] text-foreground font-medium",
    )}
  >
    {children}
  </button>
);

// Big two-column choice (when was it, how did today feel).
const BigChoice = ({
  selected,
  onClick,
  children,
  tall,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tall?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    data-onb-interactive
    style={{ touchAction: "manipulation" }}
    className={cn(
      "rounded-[18px] border text-lg transition-colors flex flex-col items-center justify-center gap-1.5",
      tall ? "h-[88px]" : "h-[58px]",
      selected
        ? "border-primary bg-primary/15 text-primary font-semibold"
        : "border-foreground/[0.14] bg-foreground/[0.06] font-medium",
    )}
  >
    {children}
  </button>
);

const Tick = ({ on }: { on: boolean }) => (
  <span
    className={cn(
      "h-[26px] w-[26px] shrink-0 rounded-lg flex items-center justify-center",
      on ? "bg-primary" : "border-2 border-foreground/35",
    )}
  >
    {on && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
  </span>
);

const ReminderRow = ({ on, setOn, label }: { on: boolean; setOn: (v: boolean) => void; label: string }) => {
  const { t } = useTranslation();
  return (
    <div className="w-full rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-4 py-3.5 flex items-center gap-3">
      <Bell className="h-[22px] w-[22px] shrink-0 text-primary" strokeWidth={2} />
      <span className="flex-1 text-[16px] text-left">{label}</span>
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
    <div className={cn("w-full rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-4 py-2.5 flex items-center gap-2", className)}>
      <span className="flex-1 text-[16px] text-left">{t("doors.polTitle")}</span>
      {(["male", "female"] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => {
            setPol(p);
            writePol(p);
          }}
          aria-pressed={pol === p}
          data-onb-interactive
          className={cn(
            "h-10 px-4 rounded-full border text-[16px] transition-colors",
            pol === p
              ? "border-primary bg-primary/15 text-primary font-semibold"
              : "border-foreground/[0.18] bg-foreground/[0.05] font-medium",
          )}
        >
          {p === "male" ? t("doors.polHe") : t("doors.polShe")}
        </button>
      ))}
    </div>
  );
};

// The last screen of every path: Malu, one word, the reminder, Go.
const DoneScreen = ({
  title,
  rows,
  onDone,
}: {
  title: string;
  rows?: { label: string }[];
  onDone: (reminders: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState(true);
  const time = getNotificationSettings().time;
  return (
    <Screen className="items-center text-center">
      <div className="flex-1 min-h-6" />
      <img src={maluHappy} alt="" aria-hidden="true" className="h-[200px] w-[200px] -mt-5 -mb-7" />
      <h1 className="text-[40px] leading-[1.1] font-bold tracking-tight">{title}</h1>
      {rows && rows.length > 0 && (
        <div className="mt-6 w-full rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] divide-y divide-foreground/[0.08] text-left">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
              <span className="h-6 w-6 shrink-0 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3.2} />
              </span>
              <span className="text-[16px]">{r.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-6" />
      <AddressPolRow className="mb-3" />
      <ReminderRow on={reminders} setOn={setReminders} label={t("doors.remindShort", { time })} />
      <div className="h-3.5" />
      <PrimaryButton onClick={() => onDone(reminders)}>{t("doors.goToday")}</PrimaryButton>
    </Screen>
  );
};

// Doors --------------------------------------------------------------

export type PickResult = { kind: "doors"; ids: DoorId[] } | { kind: "own" } | { kind: "curious" };

export const DoorPickerScreen = ({ onPick }: { onPick: (r: PickResult) => void }) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<DoorId[]>([]);
  const [alt, setAlt] = useState<"own" | "curious" | null>(null);
  const [asking, setAsking] = useState(false);
  const [main, setMain] = useState<DoorId | null>(null);

  const toggle = (id: DoorId) => {
    setAlt(null);
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
    if (picked.length === 1) {
      onPick({ kind: "doors", ids: picked });
      return;
    }
    setMain(picked[0]);
    setAsking(true);
  };

  return (
    <Screen>
      <div className="pt-1 flex justify-center">
        <img src={maluWave} alt="" aria-hidden="true" className="h-[112px] w-[112px] -mb-4" />
      </div>
      <Title className="mt-1">{t("doors.pickTitle")}</Title>
      <p className="mt-2 text-[17px] text-muted-foreground">{t("doors.pickSubtitle")}</p>
      <div className="mt-5 flex flex-col gap-2.5">
        {DOORS.map((door) => {
          const Icon = door.icon;
          const on = picked.includes(door.id);
          return (
            <button
              key={door.id}
              type="button"
              onClick={() => toggle(door.id)}
              aria-pressed={on}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-4 rounded-[20px] border text-left transition-colors",
                on ? "border-primary bg-primary/10" : "border-foreground/[0.12] bg-foreground/[0.07]",
              )}
            >
              <span className="h-10 w-10 shrink-0 rounded-full bg-foreground/[0.08] flex items-center justify-center">
                <Icon className={cn("h-5 w-5", door.iconClass)} strokeWidth={2} />
              </span>
              <span className="flex-1 text-[19px] font-semibold">{t(`doors.${door.id}.name`)}</span>
              {on && <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.6} />}
            </button>
          );
        })}
        <div className="flex gap-2.5">
          {(["own", "curious"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => pickAlt(a)}
              aria-pressed={alt === a}
              data-onb-interactive
              className={cn(
                "flex-1 py-4 rounded-[20px] text-[17px] font-semibold transition-colors",
                alt === a ? "border-[1.5px] border-primary bg-primary/10" : "border border-dashed border-foreground/30",
              )}
            >
              {t(a === "own" ? "doors.own.name" : "doors.curious.name")}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-6" />
      <PrimaryButton disabled={!alt && picked.length === 0} onClick={go}>
        {t("doors.continue")}
      </PrimaryButton>

      {/* "Which one first?" when several doors are ticked: we do one
          example together on the chosen one; the rest are just added. */}
      {asking && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/55" onClick={() => setAsking(false)} />
          <div className="relative rounded-t-[30px] bg-background px-5 pt-3 pb-safe animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-foreground/25" />
            <h2 className="mt-5 text-[30px] font-bold tracking-tight">{t("doors.which.title")}</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {picked.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMain(id)}
                  aria-pressed={main === id}
                  data-onb-interactive
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-4 rounded-[18px] border text-left text-[18px] font-semibold",
                    main === id ? "border-primary bg-primary/10" : "border-foreground/[0.14] bg-foreground/[0.05]",
                  )}
                >
                  <span className={cn("h-[22px] w-[22px] shrink-0 rounded-full", main === id ? "border-[7px] border-primary" : "border-2 border-foreground/40")} />
                  {t(`doors.${id}.name`)}
                </button>
              ))}
            </div>
            <div className="h-6" />
            <PrimaryButton
              onClick={() => {
                if (!main) return;
                setAsking(false);
                onPick({ kind: "doors", ids: [main, ...picked.filter((x) => x !== main)] });
              }}
            >
              {t("doors.which.start", { name: t(`doors.${main ?? picked[0]}.short`) })}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Screen>
  );
};

// Door flow -----------------------------------------------------------

type When = "today" | "yesterday" | "thisWeek" | "longAgo";
const WHEN_OPTIONS: When[] = ["today", "yesterday", "thisWeek", "longAgo"];
const FEEL_ICON: Record<Feeling, typeof Smile> = { good: Smile, okay: Meh, low: Frown, anxious: Waves };

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
  const isMood = main.kind === "state";
  const [stage, setStage] = useState<"entry" | "context" | "done">("entry");
  const [when, setWhen] = useState<When | null>(null);
  const [daysAgo, setDaysAgo] = useState(2);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, boolean | undefined>>({});
  const [saving, setSaving] = useState(false);

  // Mood answers anxiety on the feeling screen, so it isn't asked again.
  const skip = isMood ? ["felt-anxious"] : [];
  const contextIds = useMemo(() => contextFor(doors, skip), [doors]); // eslint-disable-line react-hooks/exhaustive-deps
  const entryOffset = isMood ? 0 : when === "today" ? 0 : when === "yesterday" ? 1 : when === "thisWeek" ? daysAgo : null;

  const toggleTag = (id: string) =>
    setTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const commit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // One after another: each call reads and rewrites the whole tracker
      // list, so running them in parallel kept only the last door's.
      const ensured: Awaited<ReturnType<typeof ensureDoorTrackers>>[] = [];
      for (const d of doors) ensured.push(await ensureDoorTrackers(d));
      const byTemplate = new Map<string, string>();
      doors.forEach((d, i) => {
        byTemplate.set(d.mainTemplateId, ensured[i].trackerId);
        d.contextTemplateIds.forEach((tpl, j) => byTemplate.set(tpl, ensured[i].contextTrackerIds[j]));
      });
      saveDoorState({
        id: main.id,
        trackerId: ensured[0].trackerId,
        contextTrackerIds: ensured[0].contextTrackerIds,
        startedAt: isoLocal(new Date()),
        extra: extras.map((d, i) => ({ id: d.id, trackerId: ensured[i + 1].trackerId })),
      });
      if (entryOffset !== null) {
        const ctx: Record<string, boolean | undefined> = {};
        for (const tpl of contextIds) {
          const id = byTemplate.get(tpl);
          if (id) ctx[id] = context[tpl];
        }
        let value = true;
        if (isMood && feeling) {
          const a = feelingAnswers(feeling);
          value = a.low;
          const anxiousId = byTemplate.get("felt-anxious");
          if (anxiousId) ctx[anxiousId] = a.anxious;
        }
        await logDoorEntry({ trackerId: ensured[0].trackerId, date: daysAgoIso(entryOffset), tags, value, context: ctx });
      }
      track("first_entry_logged", {
        door: main.id,
        doors: doors.length,
        when: isMood ? feeling ?? "none" : when ?? "none",
        reasons: tags.length,
        context: Object.values(context).filter((v) => typeof v === "boolean").length,
      });
    } catch (err) {
      console.error("[DoorFlow] commit failed:", err);
    } finally {
      setSaving(false);
      setStage("done");
    }
  };

  if (stage === "entry") {
    return (
      <Screen>
        <TopBar onBack={onBack} step={0} />
        <Title className="mt-6">{isMood ? t("doors.feel.title") : t(`doors.${main.id}.whenTitle`)}</Title>
        {isMood ? (
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {FEELINGS.map((f) => {
              const Icon = FEEL_ICON[f];
              return (
                <BigChoice key={f} tall selected={feeling === f} onClick={() => setFeeling(f)}>
                  <Icon className="h-6 w-6" strokeWidth={2} />
                  {t(`doors.feel.${f}`)}
                </BigChoice>
              );
            })}
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {WHEN_OPTIONS.map((w) => (
                <BigChoice key={w} selected={when === w} onClick={() => setWhen(w)}>
                  {t(`doors.when.${w}`)}
                </BigChoice>
              ))}
            </div>
            {when === "thisWeek" && (
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[2, 3, 4, 5, 6].map((n) => {
                  const d = new Date(daysAgoIso(n) + "T12:00:00");
                  const on = daysAgo === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDaysAgo(n)}
                      aria-pressed={on}
                      data-onb-interactive
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-2 rounded-2xl border text-sm transition-colors",
                        on ? "border-primary bg-primary/15 text-primary font-semibold" : "border-foreground/[0.14] bg-foreground/[0.06] text-muted-foreground",
                      )}
                    >
                      <span className="capitalize">{format(d, "EEE", { locale: dateLocale })}</span>
                      <span className={cn("text-lg font-semibold", !on && "text-foreground")}>{format(d, "d")}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {(isMood ? feeling !== null : when !== null && when !== "longAgo") && (
          <>
            <h2 className="mt-8 text-[22px] font-bold tracking-tight">{t(`doors.${main.id}.reasonsTitle`)}</h2>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {main.reasons.map((r) => (
                <Chip key={r} selected={tags.includes(r)} onClick={() => toggleTag(r)}>
                  {t(`doors.reasons.${r}`)}
                </Chip>
              ))}
            </div>
          </>
        )}
        <div className="flex-1 min-h-6" />
        <PrimaryButton
          disabled={(isMood ? !feeling : !when) || saving}
          onClick={() => {
            if (!isMood && when === "longAgo") void commit();
            else if (contextIds.length === 0) void commit();
            else setStage("context");
          }}
        >
          {t("doors.next")}
        </PrimaryButton>
      </Screen>
    );
  }

  if (stage === "context") {
    return (
      <Screen>
        <TopBar onBack={() => setStage("entry")} step={1} />
        <Title className="mt-6">{t("doors.contextTitle")}</Title>
        <div className="mt-6 flex flex-col">
          {contextIds.map((tplId, i) => {
            const value = context[tplId];
            const set = (v: boolean) => setContext((prev) => ({ ...prev, [tplId]: prev[tplId] === v ? undefined : v }));
            return (
              <div key={tplId} className={cn("py-5", i > 0 && "border-t border-foreground/10")}>
                <p className="text-[19px] font-semibold leading-snug">{t(`doors.context.${tplId}.ask`)}</p>
                <div className="mt-3 flex gap-2.5">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => set(v)}
                      aria-pressed={value === v}
                      data-onb-interactive
                      style={{ touchAction: "manipulation" }}
                      className={cn(
                        // Neutral: the chosen answer is just white. Rose/mint read
                        // as wrong/right answers (same rule as the evening card).
                        "flex-1 h-[52px] rounded-2xl border-[1.5px] text-[17px] transition-colors",
                        value === v ? "border-foreground bg-foreground/15 font-bold" : "border-foreground/[0.18] bg-foreground/[0.05] font-medium",
                      )}
                    >
                      {v ? t("common.yes") : t("common.no")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 min-h-6" />
        <PrimaryButton disabled={saving} onClick={() => void commit()}>
          {t("doors.save")}
        </PrimaryButton>
      </Screen>
    );
  }

  const rows = extras.length
    ? [
        { label: `${t(`doors.${main.id}.name`)} · ${t("doors.firstEntryShort")}` },
        ...extras.map((d) => ({ label: `${t(`doors.${d.id}.name`)} · ${t("doors.readyShort")}` })),
      ]
    : undefined;
  return (
    <DoneScreen
      title={entryOffset === null ? t("doors.loggedTitleFresh") : t("doors.loggedTitle")}
      rows={rows}
      onDone={(reminders) => onFinish({ path: "door", reminders })}
    />
  );
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
          className="mt-5 w-full rounded-[18px] border-[1.5px] border-primary bg-foreground/[0.06] px-4 py-4 text-[18px] text-foreground placeholder:text-muted-foreground outline-none"
        />
        <p className="mt-7 text-[17px] font-semibold text-muted-foreground">{t("doors.own.orPick")}</p>
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
        <div className="mt-5 rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] divide-y divide-foreground/[0.08]">
          {text.trim() &&
            row(
              "own",
              <span className="flex flex-col gap-1">
                <span className="self-start rounded-full bg-[hsl(258_100%_86%/0.2)] px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[hsl(258_100%_86%)]">
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
            <p className="mt-6 px-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("doors.own.maybeAlso")}</p>
            <div className="mt-2.5 rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] divide-y divide-foreground/[0.08]">
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

  return <DoneScreen title={t("doors.ready")} onDone={(reminders) => onFinish({ path: "own", reminders })} />;
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
          <span key={i} className={cn("aspect-square rounded-[5px]", on.includes(i + 1) ? cls : "bg-foreground/[0.08]")} />
        ))}
      </div>
    );
    return (
      <Screen>
        <TopBar onBack={onBack} />
        <Title className="mt-6">{t("doors.curious.exampleTitle")}</Title>
        <div className="mt-6 rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] p-[18px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{t("doors.curious.found")}</span>
            <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-emerging/70 text-emerging text-[11px] font-bold uppercase tracking-[0.12em]">
              {t("doors.exampleBadge")}
            </span>
          </div>
          <p className="mt-2.5 text-[22px] font-bold leading-tight">{t("doors.curious.sentence")}</p>
          <p className="mt-3 mb-1.5 text-xs font-semibold text-muted-foreground">{t("doors.curious.shortNight")}</p>
          {strip(EXAMPLE_A, "bg-primary")}
          <p className="mt-2.5 mb-1.5 text-xs font-semibold text-muted-foreground">{t("doors.curious.lowMood")}</p>
          {strip(EXAMPLE_B, "bg-foreground/75")}
          <span className="mt-3.5 inline-flex items-center h-7 px-3 rounded-full bg-balanced/25 text-balanced text-[13px] font-semibold">
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
        <img src={maluHappy} alt="" aria-hidden="true" className="h-[120px] w-[120px] -mt-3 -mb-4" />
      </div>
      <Title className="mt-2">{t("doors.curious.weekTitle")}</Title>
      <p className="mt-2.5 text-[18px] text-muted-foreground">{t("doors.curious.weekSub")}</p>
      <div className="mt-5 rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] divide-y divide-foreground/[0.08] text-left">
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
              "h-9 rounded-xl flex items-center justify-center text-[13px] font-semibold",
              i === 6 ? "border-[1.5px] border-primary text-primary" : "border-[1.5px] border-dashed border-foreground/25 text-muted-foreground",
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
