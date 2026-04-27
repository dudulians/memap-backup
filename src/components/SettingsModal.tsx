import { useState, useEffect } from "react";
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
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Bell, Trash2, Flame, Download, ListChecks, GripVertical, Eye, EyeOff, Volume2, HelpCircle, FileSpreadsheet, Upload, Lock, Palette, Sparkles, BookOpen, Sun, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimePickerField } from "@/components/TimePickerField";
import { useToast } from "@/hooks/use-toast";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { resetTourSeen } from "@/components/OnboardingTour";
import { getTheme, setTheme, AppTheme } from "@/lib/theme";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

interface SessionSettings {
  includeSuggestedQuestions: boolean;
  soundEnabled: boolean;
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

const SETTINGS_KEYS = [
  "memap_session_settings",
  "memap_notification_enabled",
  "memap_notification_time",
  "memap_ideas_dismissed",
];

const getSessionSettings = (): SessionSettings => {
  const data = localStorage.getItem(SESSION_SETTINGS_KEY);
  const fallback: SessionSettings = { includeSuggestedQuestions: true, soundEnabled: true };
  if (!data) return fallback;
  try { return JSON.parse(data); } catch { return fallback; }
};

const saveSessionSettings = (settings: SessionSettings) => {
  localStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(settings));
};

export const SettingsModal = ({ open, onClose, onStartTour }: SettingsModalProps) => {
  const [notificationSettings, setNotificationSettings] = useState(getNotificationSettings());
  const [sessionSettings, setSessionSettings] = useState(getSessionSettings());
  const [globalStreak, setGlobalStreak] = useState({ currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 });
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [ideasDismissed, setIdeasDismissed] = useState(() => localStorage.getItem("memap_ideas_dismissed") === "true");
  const [theme, setThemeState] = useState<AppTheme>(() => getTheme());
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
    | "appearance"
    | "notifications"
    | "session"
    | "trackers"
    | "help"
    | "data";
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

  // iOS-native swipe-back: pointer that lands within 36px of the
  // left edge and travels >60px right (with horizontal-dominant
  // motion) navigates back to the main settings list. We attach
  // listeners on the document during capture phase so vaul's own
  // pointer handling on the drawer can't swallow our event first.
  // Vertical-dominant swipes still flow through to vaul for
  // drag-to-dismiss.
  useEffect(() => {
    if (!open || screen === "main") return;
    let startX: number | null = null;
    let startY: number | null = null;
    let active = false;
    const onDown = (e: PointerEvent) => {
      if (e.clientX > 36) return;
      startX = e.clientX;
      startY = e.clientY;
      active = true;
    };
    const onMove = (e: PointerEvent) => {
      if (!active || startX === null || startY === null) return;
      const dx = e.clientX - startX;
      const dy = Math.abs(e.clientY - startY);
      if (dx > 60 && dx > dy * 1.5) {
        setScreen("main");
        active = false;
      } else if (dy > 30 && dy > Math.abs(dx)) {
        // Vertical-dominant — let vaul handle drag-to-dismiss.
        active = false;
      }
    };
    const reset = () => { active = false; startX = null; startY = null; };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", reset, true);
    document.addEventListener("pointercancel", reset, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", reset, true);
      document.removeEventListener("pointercancel", reset, true);
    };
  }, [open, screen]);

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
  const { toast } = useToast();

  const handleLanguageChange = (lng: SupportedLanguage) => {
    setCurrentLang(lng);
    setLanguage(lng);
  };

  const handleThemeChange = (next: AppTheme) => {
    setThemeState(next);
    setTheme(next);
  };

  const handleToggleIdeas = (show: boolean) => {
    localStorage.setItem("memap_ideas_dismissed", show ? "false" : "true");
    setIdeasDismissed(!show);
    window.dispatchEvent(new CustomEvent("memap-settings-changed"));
  };

  useEffect(() => {
    if (open) {
      loadData();
      // Re-sync from localStorage every time the modal opens, so changes
      // made elsewhere (e.g. the onboarding tour's notification toggle)
      // reflect here immediately.
      setNotificationSettings(getNotificationSettings());
      setSessionSettings(getSessionSettings());
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
    if (enabled) {
      const result = await requestNotificationPermissionDetailed();
      if (!result.granted) {
        const messages: Record<string, { title: string; description: string }> = {
          "insecure-origin": {
            title: t("permissions.insecureOriginTitle"),
            description: t("permissions.insecureOriginDesc"),
          },
          unsupported: {
            title: t("permissions.unsupportedTitle"),
            description: t("permissions.unsupportedDesc"),
          },
          denied: {
            title: t("permissions.deniedTitle"),
            description: t("permissions.deniedDesc"),
          },
          unknown: {
            title: t("permissions.unknownTitle"),
            description: t("permissions.unknownDesc"),
          },
        };
        const msg = messages[result.reason ?? "unknown"] ?? messages.unknown;
        toast({ ...msg, variant: "destructive" });
        return;
      }
    }

    const newSettings = { ...notificationSettings, enabled };
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);

    if (enabled) {
      scheduleNotification(newSettings);
      toast({
        title: t("settings.notificationsEnabled"),
        description: t("settings.notificationsEnabledDesc", { time: newSettings.time }),
      });
    } else {
      toast({
        title: t("settings.notificationsDisabled"),
        description: t("settings.notificationsDisabledDesc"),
      });
    }
  };

  const handleTimeChange = (time: string) => {
    const newSettings = { ...notificationSettings, time };
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);

    if (notificationSettings.enabled) {
      scheduleNotification(newSettings);
      toast({
        title: t("settings.timeUpdated"),
        description: t("settings.timeUpdatedDesc", { time }),
      });
    }
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

  const handleExportData = async () => {
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

    toast({
      title: t("settings.exportReady"),
      description: t("settings.exportReadyDesc"),
    });
  };

  const handleBackupJSON = async () => {
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
    const file = new File([JSON.stringify(payload, null, 2)], filename, { type: "application/json" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "MeMap Backup" });
        return;
      } catch {
        return;
      }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: t("settings.backupSaved"), description: t("settings.backupSavedDesc") });
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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
      toast({
        title: t("settings.invalidBackup"),
        description: t("settings.invalidBackupDesc"),
        variant: "destructive",
      });
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;

    await saveTrackers(pendingImport.trackers);
    await saveEntries(pendingImport.entries);
    localStorage.setItem("memap_notes", JSON.stringify(pendingImport.notes ?? []));

    if (pendingImport.settings) {
      Object.entries(pendingImport.settings).forEach(([k, v]) => {
        if (v === null || v === undefined) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      });
    }

    setImportDialogOpen(false);
    setPendingImport(null);
    toast({ title: t("settings.dataRestored"), description: t("settings.dataRestoredDesc") });
    setTimeout(() => window.location.reload(), 800);
  };

  const handleResetData = () => {
    localStorage.clear();
    setResetDialogOpen(false);
    toast({
      title: t("settings.dataCleared"),
      description: t("settings.dataClearedDesc"),
    });
    window.location.reload();
  };

  // Body scroll lock used to be needed when Settings was a fullscreen
  // overlay. The Sheet primitive (Radix Dialog under the hood) now
  // handles modal scroll-lock + focus management automatically.

  return (
    <>
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
        <div className="px-5 pt-3 pb-3 border-b border-border/40 flex-shrink-0 flex items-center gap-2 min-h-[3rem]">
          {screen !== "main" && (
            <button
              type="button"
              onClick={() => setScreen("main")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1"
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
            {screen === "appearance" && t("settings.appearance")}
            {screen === "notifications" && t("settings.dailyRemindersTitle")}
            {screen === "session" && t("settings.dailySessionTitle")}
            {screen === "trackers" && t("settings.trackersTitle")}
            {screen === "help" && t("settings.helpTitle")}
            {screen === "data" && t("settings.dataPrivacyTitle")}
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

                {/* Category list — Apple iOS Settings style. Each row
                    shows the current value on the right so the user
                    doesn't have to drill in just to read state. */}
                {(() => {
                  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.label ?? "";
                  const polLabel = t(`gender.${currentPol}`);
                  const themeLabel = theme === "aurora-dark"
                    ? t("settings.themeAuroraDark")
                    : theme === "aurora-light"
                      ? t("settings.themeAuroraLight")
                      : t("settings.themeClassic");
                  const notifLabel = notificationSettings.enabled
                    ? notificationSettings.time
                    : t("common.off", { defaultValue: "Off" });
                  const activeTrackerCount = trackers.filter((tr) => !tr.archived).length;

                  type Row = {
                    key: SettingsScreen;
                    icon: typeof Languages;
                    label: string;
                    value?: string;
                  };
                  const rows: Row[] = [
                    { key: "language", icon: Languages, label: t("language.settingsLabel"), value: langLabel },
                    { key: "gender", icon: User, label: t("gender.settingsLabel"), value: polLabel },
                    { key: "appearance", icon: Palette, label: t("settings.appearance"), value: themeLabel },
                    { key: "notifications", icon: Bell, label: t("settings.dailyRemindersTitle"), value: notifLabel },
                    { key: "session", icon: Volume2, label: t("settings.dailySessionTitle") },
                    { key: "trackers", icon: ListChecks, label: t("settings.trackersTitle"), value: String(activeTrackerCount) },
                    { key: "help", icon: HelpCircle, label: t("settings.helpTitle") },
                    { key: "data", icon: Database, label: t("settings.dataPrivacyTitle") },
                  ];
                  return (
                    <div className="rounded-2xl border border-border/40 overflow-hidden divide-y divide-border/40">
                      {rows.map((row) => {
                        const Icon = row.icon;
                        return (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => setScreen(row.key)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
                          >
                            <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
                            <span className="flex-1 text-sm font-medium">{row.label}</span>
                            {row.value && (
                              <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                                {row.value}
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            {/* === LANGUAGE SUB-SCREEN === */}
            {screen === "language" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Languages className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{t("language.settingsLabel")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("language.subtitle")}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {SUPPORTED_LANGUAGES.map((lng) => {
                      const isActive = currentLang === lng.code;
                      return (
                        <button
                          key={lng.code}
                          onClick={() => handleLanguageChange(lng.code)}
                          className={`rounded-xl border p-2.5 text-left transition-all ${
                            isActive
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/50 hover:border-border bg-muted/20"
                          }`}
                        >
                          <div className="text-sm font-medium">{lng.native}</div>
                          {lng.native !== lng.name && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{lng.name}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* === GENDER SUB-SCREEN === */}
            {screen === "gender" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{t("gender.settingsLabel")}</h3>
                    <p className="text-xs text-muted-foreground">{t("gender.subtitle")}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["male", "female", "neutral"] as const).map((p) => {
                      const isActive = currentPol === p;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePolChange(p)}
                          className={`rounded-xl border p-2.5 text-center transition-all text-sm ${
                            isActive
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30 font-medium"
                              : "border-border/50 hover:border-border bg-muted/20"
                          }`}
                        >
                          {t(`gender.${p}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* === APPEARANCE SUB-SCREEN === */}
            {screen === "appearance" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{t("settings.appearance")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.appearanceDesc")}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleThemeChange("classic")}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-all ${
                        theme === "classic"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{t("settings.themeClassic")}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        {t("settings.themeClassicDesc")}
                      </span>
                    </button>
                    <button
                      onClick={() => handleThemeChange("aurora-light")}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-all ${
                        theme === "aurora-light"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{t("settings.themeAuroraLight")}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        {t("settings.themeAuroraLightDesc")}
                      </span>
                    </button>
                    <button
                      onClick={() => handleThemeChange("aurora")}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-all ${
                        theme === "aurora"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{t("settings.themeAuroraDark")}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        {t("settings.themeAuroraDarkDesc")}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* === NOTIFICATIONS SUB-SCREEN === */}
            {screen === "notifications" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{t("settings.dailyRemindersTitle")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.dailyRemindersDesc")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifications-toggle" className="text-sm">
                      {t("settings.enableNotifications")}
                    </Label>
                    <Switch
                      id="notifications-toggle"
                      checked={notificationSettings.enabled}
                      onCheckedChange={handleNotificationToggle}
                    />
                  </div>

                  {notificationSettings.enabled && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="space-y-2">
                        <Label className="text-sm">{t("settings.reminderTime")}</Label>
                        <TimePickerField
                          value={notificationSettings.time}
                          onChange={handleTimeChange}
                        />
                      </div>

                      <div className="flex items-start justify-between gap-3 pt-2 border-t border-border/30">
                        <div className="flex-1">
                          <Label htmlFor="threshold-toggle" className="text-sm">
                            {t("settings.actionSignalAlerts")}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("settings.actionSignalAlertsDesc")}
                          </p>
                        </div>
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
              </div>
            </div>
            )}

            {/* === SESSION SUB-SCREEN === */}
            {screen === "session" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ListChecks className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{t("settings.dailySessionTitle")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.dailySessionDesc")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggested-toggle" className="text-sm">
                      {t("settings.includeSuggested")}
                    </Label>
                    <Switch
                      id="suggested-toggle"
                      checked={sessionSettings.includeSuggestedQuestions}
                      onCheckedChange={(v) => handleSessionSettingsChange("includeSuggestedQuestions", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="sound-toggle" className="text-sm">
                        {t("settings.soundAndVibration")}
                      </Label>
                    </div>
                    <Switch
                      id="sound-toggle"
                      checked={sessionSettings.soundEnabled}
                      onCheckedChange={(v) => handleSessionSettingsChange("soundEnabled", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="ideas-toggle" className="text-sm">
                      {t("settings.showTrackerIdeas")}
                    </Label>
                    <Switch
                      id="ideas-toggle"
                      checked={!ideasDismissed}
                      onCheckedChange={handleToggleIdeas}
                    />
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* === TRACKERS SUB-SCREEN === */}
            {screen === "trackers" && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm">{t("settings.trackersTitle")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("settings.trackersDesc")}
              </p>
              
              <div className="space-y-2">
                {trackers.map(tracker => (
                  <div
                    key={tracker.id}
                    className="flex items-center gap-3 p-2 rounded-xl bg-muted/30"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    {(() => {
                      const SIcon = getTrackerIcon(tracker.title, tracker.category);
                      return <SIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
                    })()}
                    <span className="flex-1 text-sm truncate">{localizeTrackerTitle(tracker.title)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleTrackerActive(tracker.id)}
                      className="h-8 w-8"
                    >
                      {tracker.archived ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                  </div>
                ))}
                {trackers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("settings.noTrackersYet")}
                  </p>
                )}
              </div>
            </div>
            )}

            {/* === HELP SUB-SCREEN === */}
            {screen === "help" && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm">{t("settings.helpTitle")}</h3>
              <Button
                variant="outline"
                onClick={() => {
                  resetTourSeen();
                  onStartTour?.();
                }}
                className="w-full justify-start"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                {t("settings.showAppTour")}
              </Button>
            </div>
            )}

            {/* === DATA & PRIVACY SUB-SCREEN === */}
            {screen === "data" && (
            <div className="space-y-4">
              <h3 className="font-medium text-sm">{t("settings.dataPrivacyTitle")}</h3>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border/30">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("settings.dataPrivacyLock")}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleBackupJSON}
                className="w-full justify-start"
              >
                <Download className="h-4 w-4 mr-2" />
                {t("settings.backupFull")}
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileSelected}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label={t("settings.importBackupLabel")}
                />
                <Button variant="outline" className="w-full justify-start pointer-events-none">
                  <Upload className="h-4 w-4 mr-2" />
                  {t("settings.restoreBackup")}
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleExportData}
                className="w-full justify-start"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t("settings.exportCsv")}
              </Button>

              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-medium text-sm text-destructive">{t("settings.resetAllTitle")}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.resetAllDesc")}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setResetDialogOpen(true)}
                      className="w-full"
                    >
                      {t("settings.resetAllBtn")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </BottomSheet>

      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
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
            <AlertDialogCancel onClick={() => setPendingImport(null)}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>
              {t("settings.restoreBtn")}
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
