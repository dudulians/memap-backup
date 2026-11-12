import { useState, useEffect, useRef } from "react";
import { isColorBlind, setColorBlind } from "@/lib/colorBlind";
import { useTranslation } from "react-i18next";
import { haptics } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SUPPORTED_LANGUAGES, SupportedLanguage, setLanguage, getLanguage } from "@/lib/i18n";
import { Languages, User } from "lucide-react";
import { POL_CHANGED_EVENT, getPol } from "@/lib/genderPolish";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getNotificationSettings, saveNotificationSettings, requestNotificationPermissionDetailed, scheduleNotification } from "@/lib/notifications";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { getEntries, getTrackers, saveTrackers, saveEntries } from "@/lib/storage";
import { generateDevData } from "@/lib/devDataGenerator";
import {
  generateDemoData,
  DEMO_PACK_IDS,
  type DemoPackId,
} from "@/lib/demoDataGenerator";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Trash2, Download, Volume2, HelpCircle, FileSpreadsheet, Upload, Lock, Sparkles, ChevronLeft, ChevronRight, Database, FlaskConical, Mail, FileText, Star, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimePickerField } from "@/components/TimePickerField";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { resetTourSeen } from "@/components/OnboardingTour";
import { resetCoachmarkSeen, resetTourKey } from "@/components/CoachmarkTour";
import { getTheme, switchTheme, getLegacyTheme, AppTheme } from "@/lib/theme";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { AvatarPicker } from "@/components/AvatarPicker";
import { switchToOld } from "@/components/UpgradeInvite";
import { History } from "lucide-react";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { track, useScreen, onbLabel, setOnbPreview, type OnbVariant } from "@/lib/analytics";
import { markPlayfulAsked, setPlayful, usePlayful } from "@/lib/playful";
import { APP_STORE_REVIEW_URL } from "@/lib/appRating";
import { captureError } from "@/lib/sentry";
import { getDoorState } from "@/lib/doors";
import { isSensitiveTrackerTitle } from "@/lib/correlations";
import { SOUNDS_PAUSED } from "@/lib/feedback";

// Shown under Data & privacy and in support emails. Bump with each release.
const APP_VERSION = "2.0";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

interface SessionSettings {
  soundEnabled: boolean;
  // Vibration is its own toggle. Was previously bundled into
  // soundEnabled, which meant turning off sounds also killed haptics
  // on swipes — and the user reported wanting to keep vibration but
  // mute sounds. Defaults to true on first launch.
  hapticsEnabled: boolean;
}

const SESSION_SETTINGS_KEY = "memap_session_settings";

const BACKUP_VERSION = 1;

interface BackupPayload {
  version: number;
  exportedAt: string;
  trackers: Tracker[];
  entries: TrackerEntry[];
  notes: unknown[];
  settings: Record<string, string | null>;
}

/** The CSV (Excel) export row: off since Nov 10 2026 ("экспорт эксель не нужно"); the code stays. */
const CSV_EXPORT = false;

const SETTINGS_KEYS = [
  "memap_session_settings",
  "memap_notification_enabled",
  "memap_notification_time",
  "memap_ideas_dismissed",
];

const getSessionSettings = (): SessionSettings => {
  const data = localStorage.getItem(SESSION_SETTINGS_KEY);
  const fallback: SessionSettings = {
    soundEnabled: true,
    hapticsEnabled: true,
  };
  if (!data) return fallback;
  try {
    const parsed = JSON.parse(data) as Partial<SessionSettings>;
    // Migration: users from the combined-toggle era don't have
    // hapticsEnabled in storage. Default to soundEnabled value so
    // their previous "off everything" preference is respected — they
    // can flip just vibration back on themselves.
    return {
      soundEnabled: parsed.soundEnabled ?? true,
      hapticsEnabled:
        typeof parsed.hapticsEnabled === "boolean"
          ? parsed.hapticsEnabled
          : parsed.soundEnabled !== false,
    };
  } catch {
    return fallback;
  }
};

const saveSessionSettings = (settings: SessionSettings) => {
  localStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(settings));
};

export const SettingsModal = ({ open, onClose, onStartTour }: SettingsModalProps) => {
  useScreen("settings", open);
  const [notificationSettings, setNotificationSettings] = useState(getNotificationSettings());
  const [sessionSettings, setSessionSettings] = useState(getSessionSettings());
  const [avatarOpen, setAvatarOpen] = useState(false);
  // one tap switched the whole app (QA, Nov 8 2026): ask first, in place
  const [askOld, setAskOld] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(getAvatar());
  useEffect(() => {
    const sync = () => setAvatarId(getAvatar());
    window.addEventListener("memap-avatar-changed", sync);
    return () => window.removeEventListener("memap-avatar-changed", sync);
  }, []);
  const [globalStreak, setGlobalStreak] = useState({ currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 });
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [ideasDismissed, setIdeasDismissed] = useState(() => localStorage.getItem("memap_ideas_dismissed") === "true");
  // "Show sensitive topics" toggle. Off by default. When on, the
  // intimacy / libido / ex-partner templates appear in the Add
  // Tracker library (still hidden from random "Idea of the Day"
  // suggestions because users browse those passively). Stored under
  // its own key so backup/restore preserves the user's preference.
  const [showSensitive, setShowSensitive] = useState(
    () => localStorage.getItem("memap_show_sensitive") === "true",
  );
  const [theme, setThemeState] = useState<AppTheme>(() => getTheme());
  // "Games and rewards" (Nov 9 2026): bubbles, treasures, ranks, confetti, the streak flame
  const playful = usePlayful();
  // colour-blind mode (her pick, Nov 12 2026): orange and sky blue, good days as rings
  const [colorBlind, setColorBlindState] = useState(() => isColorBlind());
  const handleColorBlind = (on: boolean) => { setColorBlindState(on); setColorBlind(on); track("colorblind_mode", { on }); };
  const handlePlayful = (on: boolean) => {
    setPlayful(on);
    // chosen here: Today won't ask about it later
    markPlayfulAsked();
    track("playful_choice", { on, from: "settings" });
  };
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => getLanguage());
  const [currentPol, setCurrentPol] = useState<"male" | "female" | "neutral">(() => getPol() ?? "neutral");

  // Drill-down navigation state. Settings is now organised iOS-style:
  // a short main page with category rows, each tap goes to its own
  // sub-screen. Solves "I have to scroll forever to find a setting"
  // and the "drag-down doesn't close because I'm scrolled" problem.
  type SettingsScreen =
    | "main"
    | "language"
    | "gender"
    | "notifications"
    | "soundHaptics"
    | "trackers"
    | "help"
    | "data"
    | "more";
  const [screen, setScreen] = useState<SettingsScreen>("main");
  // Reset to main when the sheet closes — next time the user opens
  // Settings they should land on the main list, not the deep view
  // they last visited. Delay so the visible reset happens AFTER the
  // sheet's close animation finishes (no jarring content swap).
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => setScreen("main"), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Edge-swipe-back was removed — neither pointer events nor touch
  // events fired reliably under Capacitor + vaul on iOS WebView,
  // and chasing it further wasn't worth more wasted iterations.
  // The Back button in the header is bigger / primary-coloured /
  // 40px tall now, which is the reliable way to navigate back.
  // Worth re-attempting later via Capacitor's native gesture API,
  // but not blocking on it.

  const handlePolChange = (next: "male" | "female" | "neutral") => {
    if (next !== currentPol) haptics.tap();
    setCurrentPol(next);
    // Persist into the existing interview blob so subsequent runs of
    // polishRu / generators see the new gender. We merge to avoid
    // wiping focus / context / goal answers the user may have given.
    try {
      const raw = localStorage.getItem("memap_interview");
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        "memap_interview",
        JSON.stringify({ ...prev, pol: next })
      );
    } catch {
      // ignore storage failures
    }
    window.dispatchEvent(new Event(POL_CHANGED_EVENT));
    // Force i18next to re-render any subscribed component with the new
    // pol applied via the polishRu post-processor.
    window.dispatchEvent(new Event("memap-language-changed"));
  };
  const { t } = useTranslation();

  // No pop-up windows (her note, Nov 10 2026). Feedback stays in place: the row that was tapped
  // says "Saved" for a moment, a plain line under the row says what went wrong (until the next try).
  const [notifErr, setNotifErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<"backup" | "csv" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRow = (row: "backup" | "csv") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(row);
    flashTimer.current = setTimeout(() => setFlash(null), 2500);
  };
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const [dataErr, setDataErr] = useState<{ row: "backup" | "csv" | "restore"; text: string } | null>(null);
  // owner tools only (test data, demo packs): what happened, under their buttons
  const [ownerNote, setOwnerNote] = useState<string | null>(null);
  const [restoredNow, setRestoredNow] = useState(false);
  useEffect(() => {
    if (!open) { setNotifErr(null); setDataErr(null); setOwnerNote(null); }
  }, [open]);
  const savedMark = (
    <span className="flex items-center gap-1 text-[15px] font-semibold text-[hsl(var(--coin-teal))] animate-fade-in">
      <Check className="h-5 w-5" strokeWidth={2.6} />
      {t("settings.savedShort")}
    </span>
  );
  const errLine = (text: string) => (
    <p role="alert" data-settings-error className="px-4 pb-3 -mt-1 text-[15px] font-medium leading-snug text-destructive">{text}</p>
  );

  const handleLanguageChange = (lng: SupportedLanguage) => {
    setCurrentLang(lng);
    setLanguage(lng);
  };

  // Row styles shared by every Settings screen (1.8.0).
  const card = "settings-card rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.05] overflow-hidden divide-y divide-foreground/[0.08]";
  const row = "w-full flex items-center gap-3 px-4 min-h-[60px] py-2.5 text-left";
  const rowBtn = cn(row, "active:bg-muted/60 transition-colors");
  // Door questions go by their door name, like everywhere else.
  const doorName = (id: string) => {
    const door = getDoorState();
    const doorId = door?.trackerId === id ? door.id : door?.extra?.find((x) => x.trackerId === id)?.id;
    return doorId ? t(`doors.${doorId}.name`) : null;
  };

  const handleThemeChange = (next: AppTheme) => {
    setThemeState(next);
    switchTheme(next);
  };

  const handleToggleIdeas = (show: boolean) => {
    localStorage.setItem("memap_ideas_dismissed", show ? "false" : "true");
    setIdeasDismissed(!show);
    window.dispatchEvent(new CustomEvent("memap-settings-changed"));
  };

  const handleToggleSensitive = (show: boolean) => {
    localStorage.setItem("memap_show_sensitive", show ? "true" : "false");
    setShowSensitive(show);
    window.dispatchEvent(new CustomEvent("memap-settings-changed"));
  };

  useEffect(() => {
    if (open) {
      loadData();
      // Re-sync from localStorage every time the modal opens, so changes
      // made elsewhere (e.g. the onboarding tour's notification toggle,
      // the X-on-idea-card dismiss in TodayTab, etc.) reflect here
      // immediately. Without this, the user's "I dismissed ideas with
      // the X but Settings still shows the toggle ON" complaint —
      // Settings was only re-reading on first mount.
      setNotificationSettings(getNotificationSettings());
      setSessionSettings(getSessionSettings());
      setIdeasDismissed(localStorage.getItem("memap_ideas_dismissed") === "true");
      // Re-sync gender, language, theme — these are also read once
      // on first mount via lazy useState, but the SettingsModal
      // stays mounted across the app's lifetime. If the user picks
      // a gender during onboarding AFTER first mount, the in-state
      // currentPol is stale and shows "neutral" even though
      // localStorage has "male". User flagged this. Same risk for
      // language and theme — they can change from any other surface
      // (e.g. system theme switch). Refresh on every open.
      setCurrentPol(getPol() ?? "neutral");
      setCurrentLang(getLanguage());
      setThemeState(getTheme());
      setShowSensitive(localStorage.getItem("memap_show_sensitive") === "true");
    }
  }, [open]);

  const loadData = async () => {
    const [entries, trackersData] = await Promise.all([
      getEntries(),
      getTrackers(),
    ]);
    const streak = calculateGlobalStreak(entries);
    setGlobalStreak(streak);
    setTrackers(trackersData.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)));
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    setNotifErr(null);
    if (enabled) {
      const result = await requestNotificationPermissionDetailed();
      if (!result.granted) {
        // the switch stays off; the line under it says why, in plain words
        const r = result.reason;
        setNotifErr(t(r === "denied" ? "permissions.lineDenied" : r === "unsupported" || r === "insecure-origin" ? "permissions.lineNoApp" : "permissions.lineUnknown"));
        return;
      }
    }

    const newSettings = { ...notificationSettings, enabled };
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);

    // no pop-up: the switch moves and the time shows in the row
    if (enabled) scheduleNotification(newSettings);
  };

  const handleTimeChange = (time: string) => {
    const newSettings = { ...notificationSettings, time };
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);

    // no pop-up: the picker shows the new time
    if (notificationSettings.enabled) scheduleNotification(newSettings);
  };

  const handleSessionSettingsChange = (key: keyof SessionSettings, value: number | boolean) => {
    const newSettings = { ...sessionSettings, [key]: value };
    setSessionSettings(newSettings);
    saveSessionSettings(newSettings);
    window.dispatchEvent(new CustomEvent("memap-settings-changed"));
  };

  const handleToggleTrackerActive = async (trackerId: string) => {
    const updatedTrackers = trackers.map(t =>
      t.id === trackerId ? { ...t, archived: !t.archived } : t
    );
    setTrackers(updatedTrackers);
    await saveTrackers(updatedTrackers);
  };

  // Dev-only: generate 60 days of biased fake data for every active
  // tracker. Used by the owner to inspect how Trends and Correlations
  // look with realistic-looking data without waiting weeks of real
  // tracking. Confirmation dialog up-front because it OVERWRITES any
  // real entries inside the 60-day window.
  const [devGenDialogOpen, setDevGenDialogOpen] = useState(false);
  const [devGenRunning, setDevGenRunning] = useState(false);
  // Marketing demo generator — replaces ALL trackers + entries with
  // a curated 8-tracker / 60-day script engineered to produce stable
  // correlations + one fresh-window pattern. Four themed packs;
  // pendingDemoPack carries the choice from the button row through
  // the confirmation dialog.
  const [demoGenDialogOpen, setDemoGenDialogOpen] = useState(false);
  const [demoGenRunning, setDemoGenRunning] = useState(false);
  const [pendingDemoPack, setPendingDemoPack] = useState<DemoPackId | null>(null);
  // "Demo mode" unlock — exposes the demo buttons in production
  // builds where import.meta.env.DEV is false. Toggled by 7-tap on
  // the version label in this same Settings sub-screen. Persisted
  // in localStorage so the owner only needs to unlock once per
  // install (re-tap 7 times to lock back).
  const [demoUnlocked, setDemoUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem("memap_demo_unlocked") === "true";
    } catch {
      return false;
    }
  });
  const [versionTapCount, setVersionTapCount] = useState(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showDemoButtons = import.meta.env.DEV || demoUnlocked;
  // the onboarding test (Nov 8 2026): see A, B or C from the very start; "Random" = this phone's own group
  const [onbNow, setOnbNow] = useState(() => onbLabel());
  const previewOnb = (v: OnbVariant | null) => {
    setOnbPreview(v);
    setOnbNow(onbLabel());
    if (!v) return;
    // a clean start of that onboarding: no tips seen, no tour walked, no "Look around" step
    try {
      localStorage.removeItem("memap_tips_seen");
      localStorage.removeItem("memap_tour_completed");
      localStorage.removeItem("memap_discover_seen");
    } catch { /* ignore */ }
    resetTourSeen();
    onStartTour?.();
  };
  const handleGenerateDevData = async () => {
    setDevGenRunning(true);
    try {
      const [trackersData, entriesData] = await Promise.all([
        getTrackers(),
        getEntries(),
      ]);
      const result = generateDevData(trackersData, entriesData);
      if (result.trackerCount === 0) {
        setOwnerNote(t("settings.devDataNoTrackersDesc"));
        return;
      }
      // Persist trackers first (cycleStartDate shifted back) so when
      // saveEntries fires the memap-settings-changed event listeners
      // re-pull they see the new cycle window.
      await saveTrackers(result.newTrackers);
      await saveEntries(result.newEntries);
      setOwnerNote(t("settings.devDataGeneratedDesc", {
        count: result.generatedCount,
        trackers: result.trackerCount,
        days: result.daysCount,
      }));
      // Notify other tabs (Today / Patterns) that entries changed so
      // their views re-pull. Same event other write paths use.
      window.dispatchEvent(new CustomEvent("memap-settings-changed"));
    } catch (err) {
      console.error("generateDevData failed:", err);
      setOwnerNote(t("settings.devDataFailedTitle"));
    } finally {
      setDevGenRunning(false);
      setDevGenDialogOpen(false);
    }
  };

  // Open the demo-data confirmation for the chosen pack. The
  // generate handler reads `pendingDemoPack`.
  const openDemoConfirm = (packId: DemoPackId) => {
    setPendingDemoPack(packId);
    setDemoGenDialogOpen(true);
  };

  // Demo data — destructive. Wipes existing trackers + entries and
  // replaces them with the curated pack-specific script (see
  // demoDataGenerator.ts). Behind an explicit confirm because it
  // nukes whatever the user had.
  const handleGenerateDemoData = async () => {
    if (!pendingDemoPack) return;
    setDemoGenRunning(true);
    try {
      const result = generateDemoData(pendingDemoPack);
      // saveTrackers FIRST so the freshly persisted cycleStartDate is
      // in place by the time the entries-changed event listeners
      // re-pull entries.
      await saveTrackers(result.newTrackers);
      await saveEntries(result.newEntries);
      setTrackers(result.newTrackers);
      setOwnerNote(t("settings.demoDataGeneratedDesc", {
        trackers: result.trackerCount,
        days: result.daysCount,
      }));
      window.dispatchEvent(new CustomEvent("memap-settings-changed"));
    } catch (err) {
      console.error("generateDemoData failed:", err);
      setOwnerNote(t("settings.demoDataFailedTitle"));
    } finally {
      setDemoGenRunning(false);
      setDemoGenDialogOpen(false);
      setPendingDemoPack(null);
    }
  };

  // Version-label tap detector. Seven taps within a 2-second
  // window toggle the demo-mode unlock. Classic Apple-style
  // hidden gesture so production builds don't expose demo
  // buttons to App Store users but the owner can still trigger
  // them from a TestFlight build for screenshots.
  const handleVersionTap = () => {
    if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
    const next = versionTapCount + 1;
    if (next >= 7) {
      const newState = !demoUnlocked;
      try {
        if (newState) localStorage.setItem("memap_demo_unlocked", "true");
        else localStorage.removeItem("memap_demo_unlocked");
      } catch {
        /* ignore */
      }
      setDemoUnlocked(newState);
      setVersionTapCount(0);
      // no pop-up: the DEMO mark by the version and the demo buttons show (or go)
      haptics.success();
      return;
    }
    setVersionTapCount(next);
    versionTapTimer.current = setTimeout(() => setVersionTapCount(0), 2000);
  };

  const handleExportData = async () => {
    setDataErr(null);
    try {
      await exportCsv();
    } catch (err) {
      captureError(err, { source: "handleExportData" });
      setDataErr({ row: "csv", text: t("settings.exportFailed") });
    }
  };

  const exportCsv = async () => {
    const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
    const notes: { id: string; date: string; text: string }[] = JSON.parse(
      localStorage.getItem("memap_notes") ?? "[]"
    );
    const today = new Date().toISOString().split("T")[0];

    const escapeCell = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    // Entries sheet
    const entryRows = [
      ["Date", "Tracker", "Category", "Answer", "Significant"].join(","),
      ...entries
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => {
          const tracker = trackers.find((t) => t.id === e.trackerId);
          if (!tracker) return null;
          const significant = tracker.problemWhen === "yes" ? e.value : !e.value;
          return [
            e.date,
            escapeCell(tracker.title),
            escapeCell(tracker.category),
            e.value ? "Yes" : "No",
            significant ? "Yes" : "No",
          ].join(",");
        })
        .filter(Boolean),
    ];

    // Notes sheet
    const noteRows = [
      "",
      "--- Notes ---",
      ["Date", "Note"].join(","),
      ...notes
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((n) => [n.date, escapeCell(n.text)].join(",")),
    ];

    const csv = [...entryRows, ...noteRows].join("\n");
    const filename = `memap-${today}.csv`;
    const file = new File([csv], filename, { type: "text/csv" });

    // Web Share API (mobile) — fallback to download on desktop
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "MeMap Export" });
        return;
      } catch {
        // user cancelled — do nothing
        return;
      }
    }

    // Desktop fallback
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // the row itself says "Saved" for a moment
    flashRow("csv");
  };

  const handleBackupJSON = async () => {
    setDataErr(null);
    try {
      const [trackersData, entriesData] = await Promise.all([getTrackers(), getEntries()]);
      const notes = JSON.parse(localStorage.getItem("memap_notes") ?? "[]");
      const settings: Record<string, string | null> = {};
      SETTINGS_KEYS.forEach((k) => { settings[k] = localStorage.getItem(k); });

      const payload: BackupPayload = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        trackers: trackersData,
        entries: entriesData,
        notes,
        settings,
      };

      const today = new Date().toISOString().split("T")[0];
      const filename = `memap-backup-${today}.json`;
      const json = JSON.stringify(payload, null, 2);

      // Native path (iOS / Android) — write to Cache, then hand the
      // file URI to the OS share sheet via @capacitor/share. On iOS
      // this exposes iCloud Drive, Files, AirDrop, Mail, Notes etc.
      // — every reliable backup destination Apple offers. More
      // robust than navigator.share which can be flaky in Capacitor
      // WebView depending on iOS version.
      if (Capacitor.isNativePlatform()) {
        const written = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        try {
          await Share.share({
            title: "MeMap Backup",
            text: "MeMap data backup — save to restore later or on another device",
            url: written.uri,
            dialogTitle: t("settings.backupShareDialogTitle", {
              defaultValue: "Save MeMap backup",
            }),
          });
        } finally {
          // no copy left behind in the app's cache once it is saved where she chose (or the sheet was closed)
          // (her question, Nov 10 2026: "это безопасно?")
          await Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => undefined);
        }
        track("data_exported", {
          platform: Capacitor.getPlatform(),
          size_bytes: json.length,
        });
        return;
      }

      // Web path — Web Share API for files if available, else
      // anchor-download fallback. Used in browser preview / Lovable.
      const file = new File([json], filename, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "MeMap Backup" });
          track("data_exported", { platform: "web_share" });
          return;
        } catch {
          // User cancelled — silent.
          return;
        }
      }

      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      track("data_exported", { platform: "web_download" });
      // the row itself says "Saved" for a moment
      flashRow("backup");
    } catch (err) {
      // Closing the share sheet without picking a place isn't a failure: nothing to say.
      if (/cancel/i.test(String((err as Error)?.message ?? err))) return;
      // Log so we know if export breaks for real users.
      captureError(err, { source: "handleBackupJSON" });
      setDataErr({ row: "backup", text: t("settings.backupFailed") });
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDataErr(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupPayload>;

      if (
        typeof parsed !== "object" || parsed === null ||
        !Array.isArray(parsed.trackers) || !Array.isArray(parsed.entries)
      ) {
        throw new Error("Invalid backup file");
      }

      setPendingImport(parsed as BackupPayload);
      setImportDialogOpen(true);
    } catch {
      // a plain line under "Restore from backup", until the next file
      setDataErr({ row: "restore", text: t("settings.notABackup") });
    }
  };

  const confirmImport = async () => {
    if (!pendingImport || restoredNow) return;

    await saveTrackers(pendingImport.trackers);
    await saveEntries(pendingImport.entries);
    localStorage.setItem("memap_notes", JSON.stringify(pendingImport.notes ?? []));

    if (pendingImport.settings) {
      Object.entries(pendingImport.settings).forEach(([k, v]) => {
        if (v === null || v === undefined) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      });
    }

    track("data_imported", {
      trackers_count: pendingImport.trackers.length,
      entries_count: pendingImport.entries.length,
      backup_age_days: pendingImport.exportedAt
        ? (Date.now() - new Date(pendingImport.exportedAt).getTime()) /
          (1000 * 60 * 60 * 24)
        : -1,
    });

    // no pop-up: the Restore button itself says "Restored" with a tick, then the app restarts
    haptics.success();
    setRestoredNow(true);
    setTimeout(() => window.location.reload(), 900);
  };

  const handleResetData = () => {
    localStorage.clear();
    setResetDialogOpen(false);
    // the app restarts empty right away: that is the feedback
    window.location.reload();
  };

  // Body scroll lock used to be needed when Settings was a fullscreen
  // overlay. The Sheet primitive (Radix Dialog under the hood) now
  // handles modal scroll-lock + focus management automatically.

  return (
    <>
      <AvatarPicker open={avatarOpen} onClose={() => setAvatarOpen(false)} />
      {/* Settings bottom sheet. Header bar stays drag-eligible (vaul
          will dismiss when pulled), but the long scrollable body opts
          out of body-drag with data-vaul-no-drag. Without that, vaul's
          gesture detection fights native scroll: once the list has
          been scrolled, every subsequent pull-down is interpreted as
          "still scrolling" and never escalates to dismiss. The Apple
          Maps / Apple Music pattern is exactly this — you drag the
          pill or the top header, never the body. */}
      <BottomSheet
        open={open}
        onOpenChange={(v) => { if (!v) onClose(); }}
        className="h-[80vh] p-0 flex flex-col"
        ariaTitle={t("settings.title")}
      >
        <div className="px-5 pt-3 pb-3 flex-shrink-0 flex items-center gap-2 min-h-[3rem]">
          {screen !== "main" && (
            <button
              type="button"
              onClick={() => setScreen("main")}
              className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 -ml-1 px-2 py-1 -my-1 rounded-md min-h-[40px] active:bg-primary/10 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>{t("common.back")}</span>
            </button>
          )}
          <h2 className={cn(
            "text-lg font-semibold",
            screen !== "main" ? "absolute left-1/2 -translate-x-1/2" : ""
          )}>
            {screen === "main" && t("settings.title")}
            {screen === "language" && t("language.settingsLabel")}
            {screen === "gender" && t("gender.settingsLabel")}
            {screen === "notifications" && t("settings.dailyRemindersTitle")}
            {screen === "soundHaptics" && t("settings.soundAndHaptics")}
            {screen === "trackers" && t("settings.trackersTitle")}
            {screen === "help" && t("settings.helpTitle")}
            {screen === "data" && t("settings.dataPrivacyTitle")}
            {screen === "more" && t("settings.more")}
          </h2>
        </div>

        {/* Body — vaul handles drag-to-dismiss (vertical) directly;
            edge swipe-back is handled by a document-level listener
            above so it works even if vaul captures pointer events
            on the drawer first. */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-md px-5 py-5 space-y-6">
            {/* === MAIN SCREEN: category list === */}
            {screen === "main" && (
              <>
                {/* Streak card removed — it's already prominent on the
                    Cards screen header, no reason to duplicate it inside
                    Settings. Settings is now purely a navigation list. */}

                {/* 1.8.0: what people actually change sits on the first
                    screen with its control right in the row (reminder
                    switch, Dark | Light). The rest is one tap away under
                    "More". Canvas "MeMap: новая версия", page 12. */}
                {(() => {
                  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.native ?? "";
                  const activeTrackerCount = trackers.filter((tr) => !tr.archived).length;
                  const row = "w-full flex items-center gap-3 px-4 min-h-[60px] text-left";
                  const nav = (key: SettingsScreen, label: string, value?: string) => (
                    <button key={key} type="button" onClick={() => setScreen(key)} className={cn(row, "active:bg-muted/60 transition-colors")}>
                      <span className="flex-1 text-[17px] font-medium">{label}</span>
                      {value && <span className="text-[16px] text-muted-foreground truncate max-w-[45%]">{value}</span>}
                      <ChevronRight className="h-5 w-5 text-muted-foreground/60 flex-shrink-0" />
                    </button>
                  );
                  // Back to the old screens. Whoever came from the old look finds it first, at the top (her note,
                  // Nov 11 2026: "не очевидна кнопка, как людям, у которых была старая версия… вернуться в старую");
                  // everyone else at the end.
                  let cameFromOld = false;
                  try { cameFromOld = localStorage.getItem("memap_upgrade_invite") === "accepted"; } catch { /* at the end */ }
                  const oldRow = (
                    askOld ? (
                            <div className="px-4 py-3">
                              <p className="text-[16px] font-semibold leading-snug">{t("upgrade.oldAsk")}</p>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setAskOld(false)} className="h-11 rounded-full bg-foreground/[0.06] text-[15px] font-bold">{t("upgrade.oldStay")}</button>
                                <button type="button" onClick={() => switchToOld("settings")} className="raised-btn is-small h-11 justify-center">{t("upgrade.oldGo")}</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setAskOld(true)} className={cn(row, "active:bg-muted/60 transition-colors")}>
                              <History className="h-5 w-5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
                              <span className="flex-1 text-[17px] font-medium">{t("upgrade.oldLook")}</span>
                              <ChevronRight className="h-5 w-5 text-muted-foreground/60 flex-shrink-0" />
                            </button>
                          )
                  );
                  return (
                    <>
                      <div className="settings-card rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.05] overflow-hidden divide-y divide-foreground/[0.08]">
                        {/* no avatar row (Nov 8 2026): the animal in You has its own "Change" */}
                        {cameFromOld && oldRow}
                        <div>
                          <div className={row}>
                            <button type="button" onClick={() => setScreen("notifications")} className="flex-1 min-w-0 text-left text-[17px] font-medium">
                              {t("settings.eveningReminder")}
                            </button>
                            {notificationSettings.enabled && (
                              <button type="button" onClick={() => setScreen("notifications")} className="text-[16px] text-muted-foreground tabular-nums">
                                {notificationSettings.time}
                              </button>
                            )}
                            <Switch
                              checked={notificationSettings.enabled}
                              onCheckedChange={handleNotificationToggle}
                              aria-label={t("settings.eveningReminder")}
                            />
                          </div>
                          {notifErr && errLine(notifErr)}
                        </div>
                        <div className={row}>
                          <span className="flex-1 text-[17px] font-medium">{t("settings.theme")}</span>
                          <div className="settings-seg flex rounded-full bg-foreground/[0.08] p-1">
                            {(() => {
                              // An older theme someone already uses stays as a third option.
                              const legacy = getLegacyTheme();
                              const legacyLabel: Partial<Record<AppTheme, string>> = {
                                classic: t("settings.themeClassic"),
                                liquid: t("settings.themeLiquid"),
                                terra: t("settings.themeTerra"),
                                pop: t("settings.themePop"),
                                hush: t("settings.themeHush"),
                              };
                              const options: [AppTheme, string][] = [
                                ["aurora", t("settings.themeDark")],
                                ["aurora-light", t("settings.themeLight")],
                              ];
                              if (legacy && legacyLabel[legacy]) options.push([legacy, legacyLabel[legacy]!]);
                              return options;
                            })().map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => handleThemeChange(id)}
                                aria-pressed={theme === id}
                                className={cn(
                                  "h-9 px-3.5 rounded-full text-[15px] font-semibold transition-colors whitespace-nowrap",
                                  theme === id ? "bg-foreground text-background" : "text-muted-foreground",
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={row}>
                          <label htmlFor="playful-toggle" className="flex-1 text-[17px] font-medium">{t("settings.games")}</label>
                          <Switch id="playful-toggle" checked={playful} onCheckedChange={handlePlayful} />
                        </div>
                        <div className={row}>
                          <label htmlFor="colorblind-toggle" className="flex-1 text-[17px] font-medium">{t("settings.colorBlind")}</label>
                          <Switch id="colorblind-toggle" data-colorblind checked={colorBlind} onCheckedChange={handleColorBlind} />
                        </div>
                        {nav("trackers", t("today.myQuestions"), String(activeTrackerCount))}
                        {nav("language", t("language.settingsLabel"), langLabel)}
                        {/* Address form only matters for Russian copy */}
                        {currentLang === "ru" && nav("gender", t("gender.settingsLabel"), t(`gender.${currentPol}`))}
                      </div>

                      {/* what used to hide under "More" (her note, Nov 8 2026: "зачем more… и там повторяется
                          вернуться к старому виду"): right here, one tap each */}
                      <div className="settings-card rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.05] overflow-hidden divide-y divide-foreground/[0.08]">
                        {([
                          ["soundHaptics", Volume2, t("settings.soundAndHaptics")],
                          ["help", HelpCircle, t("settings.helpTitle")],
                          ["data", Database, t("settings.dataPrivacyTitle")],
                        ] as const).map(([key, Icon, label]) => (
                          <button key={key} type="button" onClick={() => setScreen(key)} className={cn(row, "active:bg-muted/60 transition-colors")}>
                            <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
                            <span className="flex-1 text-[17px] font-medium">{label}</span>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/60 flex-shrink-0" />
                          </button>
                        ))}
                      </div>

                      {/* empty on Android for whoever has the way back at the top */}
                      {(Capacitor.getPlatform() !== "android" || !cameFromOld) && <div className="settings-card rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.05] overflow-hidden divide-y divide-foreground/[0.08]">
                        {Capacitor.getPlatform() !== "android" && (
                          <button
                            type="button"
                            onClick={() => {
                              track("rate_app_tapped");
                              window.open(APP_STORE_REVIEW_URL, "_blank", "noopener,noreferrer");
                            }}
                            className={cn(row, "active:bg-muted/60 transition-colors")}
                          >
                            <Star className="h-5 w-5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
                            <span className="flex-1 text-[17px] font-medium">{t("settings.rateApp")}</span>
                          </button>
                        )}
                        {/* Back to the old screens, right here (her note, Nov 6 2026: ads bring
                            people to the old version; whoever tries the new one and doesn't
                            like it must find the way back without digging into "More"). */}
                        {!cameFromOld && oldRow}
                      </div>}
                    </>
                  );
                })()}
              </>
            )}

            {/* Sub-screens (1.8.0): the same card of big rows as the
                first screen, the control right in the row, no lines of
                small explanation under every heading. */}

            {/* === LANGUAGE === */}
            {screen === "language" && (
              <div className={card}>
                {SUPPORTED_LANGUAGES.map((lng) => (
                  <button key={lng.code} type="button" onClick={() => handleLanguageChange(lng.code)} className={rowBtn}>
                    <span className="flex-1 text-[17px] font-medium">{lng.native}</span>
                    {currentLang === lng.code && <Check className="h-5 w-5 text-primary" strokeWidth={2.6} />}
                  </button>
                ))}
              </div>
            )}

            {/* === ADDRESS FORM (Russian copy only) === */}
            {screen === "gender" && (
              <div className={card}>
                {(["female", "male", "neutral"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => handlePolChange(p)} className={rowBtn}>
                    <span className="flex-1 text-[17px] font-medium">{t(`gender.${p}`)}</span>
                    {currentPol === p && <Check className="h-5 w-5 text-primary" strokeWidth={2.6} />}
                  </button>
                ))}
              </div>
            )}

            {/* === EVENING REMINDER === */}
            {screen === "notifications" && (
              <div className="space-y-4">
                <div className={card}>
                  <div>
                    <div className={row}>
                      <span className="flex-1 text-[17px] font-medium">{t("settings.eveningReminder")}</span>
                      <Switch id="notifications-toggle" checked={notificationSettings.enabled} onCheckedChange={handleNotificationToggle} />
                    </div>
                    {notifErr && errLine(notifErr)}
                  </div>
                  {notificationSettings.enabled && (
                    <div className={cn(row, "animate-fade-in")}>
                      <span className="flex-1 text-[17px] font-medium">{t("settings.reminderTime")}</span>
                      <div className="w-[150px]">
                        <TimePickerField value={notificationSettings.time} onChange={handleTimeChange} />
                      </div>
                    </div>
                  )}
                </div>
                {notificationSettings.enabled && (
                  <div className={card}>
                    <div className={row}>
                      <span className="flex-1 text-[17px] font-medium">{t("settings.limitAlerts")}</span>
                      <Switch
                        id="threshold-toggle"
                        checked={notificationSettings.thresholdAlerts}
                        onCheckedChange={(v) => {
                          const next = { ...notificationSettings, thresholdAlerts: v };
                          setNotificationSettings(next);
                          saveNotificationSettings(next);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === SOUND & VIBRATION === */}
            {screen === "soundHaptics" && (
              <div className={card}>
                {!SOUNDS_PAUSED && (
                  <div className={row}>
                    <span className="flex-1 text-[17px] font-medium">{t("settings.sound")}</span>
                    <Switch id="sound-toggle" checked={sessionSettings.soundEnabled} onCheckedChange={(v) => handleSessionSettingsChange("soundEnabled", v)} />
                  </div>
                )}
                <div className={row}>
                  <span className="flex-1 text-[17px] font-medium">{t("settings.haptics")}</span>
                  <Switch id="haptics-toggle" checked={sessionSettings.hapticsEnabled} onCheckedChange={(v) => handleSessionSettingsChange("hapticsEnabled", v)} />
                </div>
              </div>
            )}

            {/* === MY QUESTIONS: show / hide. Order is set on Today. ===
                The "Show question ideas" switch is gone with the ideas
                carousel itself. */}
            {screen === "trackers" && (
              <div className="space-y-4">
                {trackers.length > 0 ? (
                  <div className={card}>
                    {trackers.map((tracker) => (
                      <div key={tracker.id} className={row}>
                        <span className={cn("flex-1 min-w-0 text-[17px] font-medium leading-snug", tracker.archived && "text-muted-foreground")}>
                          {doorName(tracker.id) ?? localizeTrackerTitle(tracker.title)}
                        </span>
                        <Switch
                          checked={!tracker.archived}
                          onCheckedChange={() => handleToggleTrackerActive(tracker.id)}
                          aria-label={doorName(tracker.id) ?? localizeTrackerTitle(tracker.title)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-[17px] text-muted-foreground">{t("settings.noTrackersYet")}</p>
                )}
                {/* Intimacy questions are no longer offered (Nov 7 2026). The switch stays
                    only for people who already track one: it shows or hides their links. */}
                {trackers.some((tr) => isSensitiveTrackerTitle(tr.title)) && (
                  <div className={card}>
                    <div className={row}>
                      <span className="flex-1 text-[17px] font-medium">{t("settings.sensitiveShort")}</span>
                      <Switch id="sensitive-toggle" checked={showSensitive} onCheckedChange={handleToggleSensitive} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === HELP === */}
            {screen === "help" && (
              <div className="space-y-4">
                <div className={card}>
                  <button
                    type="button"
                    onClick={() => {
                      // Wipe every tour / hint flag so the whole guided
                      // start runs again from scratch.
                      resetTourSeen();
                      resetCoachmarkSeen();
                      resetTourKey("memap_patterns_tour_seen");
                      resetTourKey("memap_add_tracker_tour_seen");
                      resetTourKey("memap_custom_tour_seen");
                      resetTourKey("memap_first_swipe_seen");
                      resetTourKey("memap_added_own_tracker");
                      onStartTour?.();
                    }}
                    className={rowBtn}
                  >
                    <span className="flex-1 text-[17px] font-medium">{t("settings.showAppTour")}</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const subject = encodeURIComponent("MeMap support");
                      const body = encodeURIComponent(
                        `\n\n\n---\nApp version: ${APP_VERSION}\nPlatform: ${Capacitor.getPlatform()}\nLanguage: ${getLanguage()}`,
                      );
                      window.open(`mailto:memap.support@gmail.com?subject=${subject}&body=${body}`, "_blank");
                    }}
                    className={rowBtn}
                  >
                    <span className="flex-1 text-[17px] font-medium">{t("settings.contactSupport")}</span>
                    <Mail className="h-5 w-5 text-muted-foreground/60" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open("https://memap-tracker.netlify.app/TERMS.html", "_blank", "noopener,noreferrer")}
                    className={rowBtn}
                  >
                    <span className="flex-1 text-[17px] font-medium">{t("settings.termsOfService")}</span>
                    <FileText className="h-5 w-5 text-muted-foreground/60" />
                  </button>
                </div>
                {/* The one place the "not a medical app" note lives (wording from her content audit, Nov 10 2026). */}
                <p data-health-note className="px-1 text-[15px] leading-snug text-muted-foreground">{t("settings.healthNote")}</p>
              </div>
            )}

            {/* === DATA & PRIVACY === */}
            {screen === "data" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <Lock className="h-5 w-5 text-primary flex-shrink-0" />
                  <p className="text-[17px] font-semibold">{t("settings.dataOnPhone")}</p>
                </div>
                <div className={card}>
                  <div>
                    <button type="button" data-row="backup" onClick={handleBackupJSON} className={rowBtn}>
                      <span className="flex-1 text-[17px] font-medium">{t("settings.backupFull")}</span>
                      {flash === "backup" ? savedMark : <Download className="h-5 w-5 text-muted-foreground/60" />}
                    </button>
                    {dataErr?.row === "backup" && errLine(dataErr.text)}
                  </div>
                  <div>
                    <div className={cn(rowBtn, "relative")}>
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={handleFileSelected}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label={t("settings.importBackupLabel")}
                      />
                      <span className="flex-1 text-[17px] font-medium">{t("settings.restoreBackup")}</span>
                      <Upload className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    {dataErr?.row === "restore" && errLine(dataErr.text)}
                  </div>
                  {/* CSV (Excel) export: off, kept in code (her note, Nov 10 2026: "экспорт эксель не нужно") */}
                  {CSV_EXPORT && (
                    <div>
                      <button type="button" data-row="csv" onClick={handleExportData} className={rowBtn}>
                        <span className="flex-1 text-[17px] font-medium">{t("settings.exportCsv")}</span>
                        {flash === "csv" ? savedMark : <FileSpreadsheet className="h-5 w-5 text-muted-foreground/60" />}
                      </button>
                      {dataErr?.row === "csv" && errLine(dataErr.text)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => window.open("https://memap-tracker.netlify.app/PRIVACY_POLICY.html", "_blank", "noopener,noreferrer")}
                    className={rowBtn}
                  >
                    <span className="flex-1 text-[17px] font-medium">{t("settings.privacyPolicy")}</span>
                    <FileText className="h-5 w-5 text-muted-foreground/60" />
                  </button>
                </div>

                {/* Owner-only tools: the test data generator (dev builds)
                    and demo packs for store screenshots (dev builds, or
                    after 7 taps on the version below). */}
                {import.meta.env.DEV && (
                  <Button
                    variant="outline"
                    onClick={() => setDevGenDialogOpen(true)}
                    className="w-full justify-start border-orange-500/40 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600"
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    {t("settings.devDataButton")}
                  </Button>
                )}
                {showDemoButtons && (
                  <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("settings.demoSectionTitle")}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {DEMO_PACK_IDS.map((packId) => (
                        <Button
                          key={packId}
                          variant="outline"
                          size="sm"
                          onClick={() => openDemoConfirm(packId)}
                          className="justify-start border-primary/40 text-primary hover:bg-primary/10 hover:text-primary text-xs"
                        >
                          {t(`settings.demoPack_${packId.replace("-", "_")}`)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {/* owner tools only: what the test / demo data did */}
                {ownerNote && showDemoButtons && (
                  <p className="px-1 text-[15px] font-medium leading-snug text-muted-foreground animate-fade-in">{ownerNote}</p>
                )}

                <div className={card}>
                  <button type="button" onClick={() => setResetDialogOpen(true)} className={rowBtn}>
                    <span className="flex-1 text-[17px] font-medium text-destructive">{t("settings.resetAllTitle")}</span>
                    <Trash2 className="h-5 w-5 text-destructive/70" />
                  </button>
                </div>

                {showDemoButtons && (
                  <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                    <div className="text-xs font-medium text-primary">{t("settings.onbTest")}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {(["A", "B", "C"] as const).map((v) => (
                        <Button key={v} variant="outline" size="sm" onClick={() => previewOnb(v)} className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">{v}</Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => previewOnb(null)} className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary text-xs">{t("settings.onbTestOff")}</Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t("settings.onbTestNow", { group: onbNow })}</p>
                  </div>
                )}

                {/* Version, and the secret 7-tap target that unlocks the
                    demo packs in store builds. */}
                <button
                  type="button"
                  onClick={handleVersionTap}
                  className="w-full text-center text-[13px] text-muted-foreground/60 pt-2 pb-2 select-none"
                >
                  MeMap {APP_VERSION}
                  {demoUnlocked && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium">
                      <Sparkles className="h-2.5 w-2.5" />
                      {t("settings.demoModeOn")}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Dev-data generator confirmation. Off in prod (button hidden
          via import.meta.env.DEV) but the dialog is rendered
          unconditionally so the JSX tree shape stays stable. */}
      <AlertDialog open={devGenDialogOpen} onOpenChange={setDevGenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.devDataConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.devDataConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={devGenRunning}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateDevData} disabled={devGenRunning}>
              {devGenRunning ? t("settings.devDataRunning") : t("settings.devDataConfirmBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demo-data confirmation. Destructive — wipes all trackers
          and entries. Description carries the chosen pack name so
          the user knows exactly what they're about to load. */}
      <AlertDialog open={demoGenDialogOpen} onOpenChange={setDemoGenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.demoDataConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDemoPack && t("settings.demoDataConfirmDescPack", {
                pack: t(`settings.demoPack_${pendingDemoPack.replace("-", "_")}`),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={demoGenRunning}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateDemoData} disabled={demoGenRunning}>
              {demoGenRunning ? t("settings.demoDataRunning") : t("settings.demoDataConfirmBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={importDialogOpen} onOpenChange={(v) => { if (!restoredNow) setImportDialogOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.restoreConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImport && t("settings.restoreConfirmDesc", {
                trackers: pendingImport.trackers?.length ?? 0,
                entries: pendingImport.entries?.length ?? 0,
                notes: pendingImport.notes?.length ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoredNow} onClick={() => setPendingImport(null)}>{t("common.cancel")}</AlertDialogCancel>
            {/* stays open: the button itself says "Restored", then the app restarts */}
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmImport(); }}>
              {restoredNow ? (
                <span className="inline-flex items-center gap-1.5"><Check className="h-5 w-5" strokeWidth={2.6} />{t("settings.restoredShort")}</span>
              ) : t("settings.restoreBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.resetConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.resetConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("settings.resetEverything")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
