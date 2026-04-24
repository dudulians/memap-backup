import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getNotificationSettings, saveNotificationSettings, requestNotificationPermissionDetailed, scheduleNotification } from "@/lib/notifications";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { getEntries, getTrackers, saveTrackers, saveEntries } from "@/lib/storage";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Bell, Trash2, Flame, Download, ListChecks, GripVertical, Eye, EyeOff, Volume2, HelpCircle, FileSpreadsheet, Upload, Lock, Palette, Sparkles, BookOpen, Sun } from "lucide-react";
import { TimePickerField } from "@/components/TimePickerField";
import { useToast } from "@/hooks/use-toast";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { resetTourSeen } from "@/components/OnboardingTour";
import { getTheme, setTheme, AppTheme } from "@/lib/theme";

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
  const { toast } = useToast();

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
            title: "Notifications need the installed app",
            description: "Web browsers block notifications on plain HTTP. Use the MeMap app, or open on HTTPS / localhost.",
          },
          unsupported: {
            title: "Not supported in this browser",
            description: "Your browser doesn't support web notifications. Use the installed MeMap app instead.",
          },
          denied: {
            title: "Permission denied",
            description: "Enable notifications for MeMap in your device settings, then try again.",
          },
          unknown: {
            title: "Couldn't enable notifications",
            description: "Something went wrong. Please try again.",
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
        title: "Notifications enabled",
        description: `You'll receive a daily reminder at ${newSettings.time}`,
      });
    } else {
      toast({
        title: "Notifications disabled",
        description: "Daily reminders have been turned off.",
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
        title: "Time updated",
        description: `Daily reminder set for ${time}`,
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
      title: "Export ready",
      description: "CSV downloaded — open in Excel or Google Sheets.",
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

    toast({ title: "Backup saved", description: "Keep this file safe to restore your data later." });
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
        title: "Invalid backup",
        description: "This file doesn't look like a MeMap backup.",
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
    toast({ title: "Data restored", description: "Your backup has been imported." });
    setTimeout(() => window.location.reload(), 800);
  };

  const handleResetData = () => {
    localStorage.clear();
    setResetDialogOpen(false);
    toast({
      title: "Data cleared",
      description: "All data has been reset.",
    });
    window.location.reload();
  };

  // Lock body scroll while the settings page is open so the background
  // doesn't scroll under it. Settings takes over the whole viewport.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
        {/* Sticky page header with back arrow */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-9 w-9 -ml-1"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-md px-5 py-5 space-y-6">
            {/* Current Streak Display */}
            <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <div className="flex items-center gap-3">
                <Flame className="h-8 w-8 text-orange-500" />
                <div className="flex-1">
                  <p className="text-3xl font-serif font-medium tabular-nums tracking-tight">{globalStreak.currentStreak}<span className="text-sm font-sans font-normal text-muted-foreground ml-1.5">days</span></p>
                  <p className="text-xs text-muted-foreground tracking-wide uppercase">Current streak</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-serif font-medium tabular-nums text-muted-foreground">{globalStreak.longestStreak}</p>
                  <p className="text-xs text-muted-foreground tracking-wide uppercase">Longest</p>
                </div>
              </div>
              {globalStreak.totalActiveDays > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {globalStreak.totalActiveDays} total days of tracking
                </p>
              )}
            </Card>

            <Separator />

            {/* Appearance */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">Appearance</h3>
                    <p className="text-xs text-muted-foreground">
                      Choose a visual style for MeMap
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
                        <span className="text-sm font-medium">Classic</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        Warm journal
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
                        <span className="text-sm font-medium">Aurora Light</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        Airy white glass
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
                        <span className="text-sm font-medium">Aurora Dark</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug">
                        Modern teal glass
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Daily Reminders */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">Daily Reminders</h3>
                    <p className="text-xs text-muted-foreground">
                      Get notified to check in each day
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifications-toggle" className="text-sm">
                      Enable notifications
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
                        <Label className="text-sm">Reminder time</Label>
                        <TimePickerField
                          value={notificationSettings.time}
                          onChange={handleTimeChange}
                        />
                      </div>

                      <div className="flex items-start justify-between gap-3 pt-2 border-t border-border/30">
                        <div className="flex-1">
                          <Label htmlFor="threshold-toggle" className="text-sm">
                            Action signal alerts
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Get notified when a tracker hits its significant-day goal
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

            <Separator />

            {/* Daily Session Settings */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ListChecks className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">Daily Session</h3>
                    <p className="text-xs text-muted-foreground">
                      Customize your daily check-in flow
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggested-toggle" className="text-sm">
                      Include suggested questions
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
                        Sound & vibration
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
                      Show tracker ideas
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

            <Separator />

            {/* Trackers Management */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Trackers</h3>
              <p className="text-xs text-muted-foreground">
                Toggle trackers on/off for daily sessions
              </p>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {trackers.map(tracker => (
                  <div
                    key={tracker.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    {(() => {
                      const SIcon = getTrackerIcon(tracker.title, tracker.category);
                      return <SIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
                    })()}
                    <span className="flex-1 text-sm truncate">{tracker.title}</span>
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
                    No trackers yet
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Help */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Help</h3>
              <Button
                variant="outline"
                onClick={() => {
                  resetTourSeen();
                  onStartTour?.();
                }}
                className="w-full justify-start"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Show app tour
              </Button>
            </div>

            <Separator />

            {/* Data & Privacy */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Data & Privacy</h3>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40 border border-border/30">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your data lives only on this device — nothing is sent to a server or collected by us.
                  Use <strong>Backup</strong> regularly to keep a safe copy, especially before changing devices.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleBackupJSON}
                className="w-full justify-start"
              >
                <Download className="h-4 w-4 mr-2" />
                Backup (full restore file)
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileSelected}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Import backup file"
                />
                <Button variant="outline" className="w-full justify-start pointer-events-none">
                  <Upload className="h-4 w-4 mr-2" />
                  Restore from backup
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleExportData}
                className="w-full justify-start"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV (Excel)
              </Button>

              <div className="pt-2">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-medium text-sm text-destructive">Reset All Data</h3>
                      <p className="text-xs text-muted-foreground">
                        Clear all trackers, entries, streaks, and settings
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setResetDialogOpen(true)}
                      className="w-full"
                    >
                      Reset All Data
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImport && (
                <>
                  This backup contains <strong>{pendingImport.trackers?.length ?? 0}</strong> trackers,{" "}
                  <strong>{pendingImport.entries?.length ?? 0}</strong> entries, and{" "}
                  <strong>{(pendingImport.notes?.length ?? 0) as number}</strong> notes.
                  <br /><br />
                  This will <strong>replace</strong> all current data on this device. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingImport(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your trackers, entries, streaks, notes, and settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
