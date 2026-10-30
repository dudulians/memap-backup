// 1.8.0 onboarding through one "door" (see src/lib/doors.ts and the
// "MeMap: новая версия" canvas, page 1). Two screens to the first
// real answer instead of twelve stops:
//   door picker → when + reasons → three context yes/no → "Logged."
// "Something else" hands control back to the old interview.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ArrowLeft, Bell, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { getNotificationSettings } from "@/lib/notifications";
import maluWave from "@/assets/malu/malu-wave.webp";
import maluHappy from "@/assets/malu/malu-happy.webp";
import {
  DOORS,
  Door,
  DoorId,
  daysAgoIso,
  ensureDoorTrackers,
  findTemplate,
  isoLocal,
  logDoorEntry,
  saveDoorState,
} from "@/lib/doors";

type When = "today" | "yesterday" | "thisWeek" | "longAgo";
const WHEN_OPTIONS: When[] = ["today", "yesterday", "thisWeek", "longAgo"];

// Shared pieces --------------------------------------------------------

const Screen = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-full w-full max-w-md mx-auto flex flex-col px-5 pt-safe pb-safe animate-fade-in">
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
    className="w-full h-[54px] rounded-full text-[17px] font-semibold mb-5"
  >
    {children}
  </Button>
);

const TopBar = ({ onBack, step }: { onBack?: () => void; step: 0 | 1 }) => {
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
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2 rounded-full transition-all",
              i === step ? "w-[22px] bg-primary" : "w-2 bg-foreground/25",
            )}
          />
        ))}
      </div>
      <span className="w-11" />
    </div>
  );
};

const DoorTag = ({ door, label }: { door: Door; label: string }) => {
  const Icon = door.icon;
  return (
    <span className="inline-flex items-center gap-2 h-8 px-3.5 rounded-full border border-strong/55 text-strong text-sm font-semibold">
      <Icon className="h-4 w-4" strokeWidth={2.2} />
      {label}
    </span>
  );
};

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
      "inline-flex items-center h-[38px] px-4 rounded-full border text-[15px] transition-colors",
      selected
        ? "border-primary bg-primary/15 text-primary font-semibold"
        : "border-foreground/[0.18] bg-foreground/[0.05] text-foreground font-medium",
    )}
  >
    {children}
  </button>
);

// Door picker -----------------------------------------------------------

export const DoorPickerScreen = ({ onPick }: { onPick: (id: DoorId | "own") => void }) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<DoorId | "own" | null>(null);

  const rows: { id: DoorId | "own"; door?: Door }[] = [
    ...DOORS.map((door) => ({ id: door.id, door })),
    { id: "own" as const },
  ];

  return (
    <Screen>
      {/* Malu waves hello: people mostly arrive from her reels, so the
          first thing they see is the same character, not a form. The
          PNG has air around the lamb, hence the negative margins. */}
      <div className="pt-2 flex justify-center">
        <img src={maluWave} alt="" aria-hidden="true" className="h-[124px] w-[124px] -mt-1 -mb-4" />
      </div>
      <h1 className="mt-1 text-[32px] leading-[1.1] font-bold tracking-tight">{t("doors.pickTitle")}</h1>
      <p className="mt-2.5 text-base leading-snug text-muted-foreground">{t("doors.pickSubtitle")}</p>
      <div className="mt-6 flex flex-col gap-2.5">
        {rows.map(({ id, door }) => {
          const Icon = door?.icon ?? Plus;
          const selected = picked === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPicked(id)}
              aria-pressed={selected}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[22px] border text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-foreground/[0.12] bg-foreground/[0.07]",
              )}
            >
              <span className="h-11 w-11 shrink-0 rounded-full bg-foreground/[0.08] flex items-center justify-center">
                <Icon className={cn("h-[22px] w-[22px]", door?.iconClass ?? "text-foreground")} strokeWidth={2} />
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[17px] font-semibold leading-snug">{t(`doors.${id}.name`)}</span>
                <span className="text-sm leading-snug text-muted-foreground">{t(`doors.${id}.blurb`)}</span>
              </span>
              {selected && <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.6} />}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-6" />
      <PrimaryButton
        disabled={!picked}
        onClick={() => {
          if (!picked) return;
          track("door_selected", { door: picked });
          onPick(picked);
        }}
      >
        {t("doors.continue")}
      </PrimaryButton>
    </Screen>
  );
};

// Door flow ---------------------------------------------------------------

export const DoorFlow = ({
  door,
  onBack,
  onFinish,
}: {
  door: Door;
  onBack: () => void;
  onFinish: (opts: { reminders: boolean }) => void;
}) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [stage, setStage] = useState<"entry" | "context" | "logged">("entry");
  const [when, setWhen] = useState<When | null>(null);
  const [daysAgo, setDaysAgo] = useState(2);
  const [tags, setTags] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, boolean | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState(true);

  const entryOffset = when === "today" ? 0 : when === "yesterday" ? 1 : when === "thisWeek" ? daysAgo : null;

  const toggleTag = (id: string) =>
    setTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const commit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { trackerId, contextTrackerIds } = await ensureDoorTrackers(door);
      saveDoorState({ id: door.id, trackerId, contextTrackerIds, startedAt: isoLocal(new Date()) });
      if (entryOffset !== null) {
        const ctx: Record<string, boolean | undefined> = {};
        door.contextTemplateIds.forEach((tplId, i) => {
          ctx[contextTrackerIds[i]] = context[tplId];
        });
        await logDoorEntry({ trackerId, date: daysAgoIso(entryOffset), tags, context: ctx });
      }
      track("first_entry_logged", {
        door: door.id,
        when: when ?? "none",
        reasons: tags.length,
        context: Object.values(context).filter((v) => typeof v === "boolean").length,
      });
    } catch (err) {
      // Trackers may already exist; the user still lands on Today.
      console.error("[DoorFlow] commit failed:", err);
    } finally {
      setSaving(false);
      setStage("logged");
    }
  };

  // Entry: when + reasons ---------------------------------------------
  if (stage === "entry") {
    return (
      <Screen>
        <TopBar onBack={onBack} step={0} />
        <div className="mt-6">
          <DoorTag door={door} label={t(`doors.${door.id}.name`)} />
        </div>
        <h1 className="mt-[18px] text-[30px] leading-[1.12] font-bold tracking-tight">
          {t(`doors.${door.id}.whenTitle`)}
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {WHEN_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWhen(w)}
              aria-pressed={when === w}
              data-onb-interactive
              style={{ touchAction: "manipulation" }}
              className={cn(
                "h-[52px] rounded-2xl border text-base transition-colors",
                when === w
                  ? "border-primary bg-primary/15 text-primary font-semibold"
                  : "border-foreground/[0.14] bg-foreground/[0.06] font-medium",
              )}
            >
              {t(`doors.when.${w}`)}
            </button>
          ))}
        </div>
        {when === "thisWeek" && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">{t("doors.when.whichDay")}</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
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
                      "flex flex-col items-center gap-0.5 py-2 rounded-2xl border text-xs transition-colors",
                      on
                        ? "border-primary bg-primary/15 text-primary font-semibold"
                        : "border-foreground/[0.14] bg-foreground/[0.06] text-muted-foreground",
                    )}
                  >
                    <span className="capitalize">{format(d, "EEE", { locale: dateLocale })}</span>
                    <span className={cn("text-base font-semibold", !on && "text-foreground")}>{format(d, "d")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <h2 className="mt-8 text-[21px] font-bold tracking-tight">{t(`doors.${door.id}.reasonsTitle`)}</h2>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{t("doors.reasonsHint")}</p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {door.reasons.map((r) => (
            <Chip key={r} selected={tags.includes(r)} onClick={() => toggleTag(r)}>
              {t(`doors.reasons.${r}`)}
            </Chip>
          ))}
        </div>
        <div className="flex-1 min-h-6" />
        {when && (
          <p className="mb-3.5 text-center text-[15px] text-muted-foreground">
            {when === "longAgo" ? t("doors.firstEntryNoteLongAgo") : t("doors.firstEntryNote")}
          </p>
        )}
        <PrimaryButton
          disabled={!when || saving}
          onClick={() => {
            if (when === "longAgo") void commit();
            else setStage("context");
          }}
        >
          {t("doors.next")}
        </PrimaryButton>
      </Screen>
    );
  }

  // Context: three yes/no about that day --------------------------------
  if (stage === "context") {
    const whenLabel =
      when === "thisWeek"
        ? format(new Date(daysAgoIso(daysAgo) + "T12:00:00"), "EEEE", { locale: dateLocale })
        : t(`doors.when.${when}`);
    const firstReason = tags[0] ? t(`doors.reasons.${tags[0]}`).toLowerCase() : null;
    const tagLabel = firstReason ? `${whenLabel} · ${firstReason}` : whenLabel;
    return (
      <Screen>
        <TopBar onBack={() => setStage("entry")} step={1} />
        <div className="mt-6">
          <DoorTag door={door} label={tagLabel.charAt(0).toUpperCase() + tagLabel.slice(1)} />
        </div>
        <h1 className="mt-[18px] text-[30px] leading-[1.12] font-bold tracking-tight">{t("doors.contextTitle")}</h1>
        <p className="mt-2.5 text-base leading-snug text-muted-foreground">{t("doors.contextSubtitle")}</p>
        <div className="mt-6 flex flex-col gap-3">
          {door.contextTemplateIds.map((tplId) => {
            const problemWhen = findTemplate(tplId)?.template.problemWhen ?? "yes";
            const value = context[tplId];
            const set = (v: boolean) =>
              setContext((prev) => ({ ...prev, [tplId]: prev[tplId] === v ? undefined : v }));
            return (
              <div
                key={tplId}
                className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-[18px] pt-[18px] pb-4 flex flex-col gap-3.5"
              >
                <p className="text-lg font-semibold leading-snug">{t(`doors.context.${tplId}.ask`)}</p>
                <div className="flex gap-2.5">
                  {[false, true].map((v) => {
                    const on = value === v;
                    const bad = (problemWhen === "yes") === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => set(v)}
                        aria-pressed={on}
                        data-onb-interactive
                        style={{ touchAction: "manipulation" }}
                        className={cn(
                          "flex-1 h-[46px] rounded-[14px] border text-base transition-colors",
                          !on && "border-foreground/[0.14] bg-foreground/[0.05] font-medium",
                          on && bad && "border-strong bg-strong/15 text-strong font-semibold",
                          on && !bad && "border-primary bg-primary/15 text-primary font-semibold",
                        )}
                      >
                        {v ? t("common.yes") : t("common.no")}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 min-h-6" />
        <p className="mb-3.5 text-center text-[15px] leading-snug text-muted-foreground">{t("doors.contextNote")}</p>
        <PrimaryButton disabled={saving} onClick={() => void commit()}>
          {t("doors.save")}
        </PrimaryButton>
      </Screen>
    );
  }

  // Logged: example month + evening reminder --------------------------
  return <LoggedScreen door={door} fresh={entryOffset === null} reminders={reminders} setReminders={setReminders} onDone={() => onFinish({ reminders })} />;
};

// Russian copy uses "сделал(а)" forms that genderPolish resolves from
// `memap_interview.pol`. The door path skips the old gender screen, so
// RU users get one optional "он / она" row on the Logged screen
// instead. Same storage and event as the interview's AboutYou step.
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

/** Optional "Как к тебе обращаться? Он / Она" row. Russian only; renders
 *  nothing in English. Used on the door "Logged" screen and on the pack
 *  screen of the "Something else" interview. */
export const AddressPolRow = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  const [pol, setPol] = useState<AddressPol | undefined>(readPol);
  if (getLanguage() !== "ru") return null;
  return (
    <div className={cn("w-full rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-3.5 py-2.5 flex items-center gap-2", className)}>
      <span className="flex-1 text-sm leading-snug">{t("doors.polTitle")}</span>
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
            "h-9 px-4 rounded-full border text-sm transition-colors",
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

// A labelled example, never the user's data: 31 days, five rose days,
// the last few not filled in yet.
const EXAMPLE_FIRST_WEEKDAY = 3;
const EXAMPLE_RED = [2, 6, 9, 14, 21];
const EXAMPLE_UNTRACKED_FROM = 28;

const LoggedScreen = ({
  door,
  fresh,
  reminders,
  setReminders,
  onDone,
}: {
  door: Door;
  fresh: boolean;
  reminders: boolean;
  setReminders: (v: boolean) => void;
  onDone: () => void;
}) => {
  const { t } = useTranslation();
  const isRu = getLanguage() === "ru";
  const dateLocale = isRu ? ruLocale : undefined;
  const time = getNotificationSettings().time;
  // Monday-first weekday initials in the UI language (5 Jan 2026 is a Monday).
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(new Date(2026, 0, 5 + i), "EEEEE", { locale: dateLocale })),
    [dateLocale],
  );

  return (
    <Screen>
      <div className="pt-4 flex items-end gap-1">
        <img src={maluHappy} alt="" aria-hidden="true" className="h-[120px] w-[120px] shrink-0 -ml-4 -mb-3" />
        <h1 className="mb-2 text-[30px] leading-[1.1] font-bold tracking-tight">
          {fresh ? t("doors.loggedTitleFresh") : t("doors.loggedTitle")}
        </h1>
      </div>
      <p className="mt-2 text-base leading-snug text-muted-foreground">{t("doors.loggedBody")}</p>

      <div className="mt-[18px] rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-4 py-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[15px] font-bold">{t("doors.exampleTitle")}</span>
          <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-emerging/70 text-emerging text-[11px] font-bold uppercase tracking-[0.12em]">
            {t("doors.exampleBadge")}
          </span>
        </div>
        <div className="grid grid-cols-7 mb-1.5" aria-hidden="true">
          {weekdays.map((s, i) => (
            <span key={i} className="text-center text-[11px] font-semibold uppercase text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1.5" aria-hidden="true">
          {Array.from({ length: EXAMPLE_FIRST_WEEKDAY }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <span
              key={d}
              className={cn(
                "mx-auto h-[30px] w-[30px] rounded-full flex items-center justify-center text-xs font-semibold",
                EXAMPLE_RED.includes(d)
                  ? "bg-strong text-strong-foreground"
                  : d >= EXAMPLE_UNTRACKED_FROM
                    ? "bg-foreground/[0.08] text-muted-foreground"
                    : "bg-balanced text-balanced-foreground",
              )}
            >
              {d}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm leading-snug">
          <span className="text-primary font-semibold">→</span> {t(`doors.${door.id}.exampleLine`)}
        </p>
      </div>

      <AddressPolRow className="mt-3" />

      <div className="mt-3 rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-3.5 py-3 flex items-center gap-3">
        <Bell className="h-[22px] w-[22px] shrink-0 text-primary" strokeWidth={2} />
        <span className="flex-1 text-sm leading-snug">
          {t("doors.reminderLine", { time, question: t(`doors.${door.id}.reminderQuestion`) })}
        </span>
        <Switch checked={reminders} onCheckedChange={setReminders} aria-label={t("doors.reminderAria")} />
      </div>

      <div className="flex-1 min-h-6" />
      <PrimaryButton onClick={onDone}>{t("doors.goToday")}</PrimaryButton>
    </Screen>
  );
};
