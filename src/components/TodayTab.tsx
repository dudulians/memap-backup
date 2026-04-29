import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries, saveTrackers } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Settings as SettingsIcon, Play, X, Lightbulb, Flame, Shuffle, Bell, Archive, Trash2, Check, ListChecks, EyeOff } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TrackerSettingsModal } from "./TrackerSettingsModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { getRandomIdeas } from "@/lib/lifeStreams";
import { localizeTrackerTitle, localizeTrackerQuestion } from "@/lib/trackerLocalize";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { DuplicateTrackerDialog } from "./DuplicateTrackerDialog";
import { TrackerDetails } from "./TrackerDetails";
import { AddTrackerModal } from "./AddTrackerModal";
import { DailySession } from "./DailySession";
import { DateSelector } from "./DateSelector";
import {
  getNotificationSettings,
  saveNotificationSettings,
  scheduleNotification,
  requestNotificationPermissionDetailed,
} from "@/lib/notifications";

import { SwipeableTrackerCard } from "./SwipeableTrackerCard";
import { calculateStreak, isStreakMilestone } from "@/lib/streaks";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { isToday, format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { getLanguage } from "@/lib/i18n";
import confetti from "canvas-confetti";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uuid } from "@/lib/uuid";

export const TodayTab = () => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const { toast } = useToast();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Ideas of the day snapshot. Re-roll whenever the user switches language so
  // the carousel text refreshes immediately (the selection is localized at the
  // moment getRandomIdeas runs, so a stale snapshot would still render in the
  // old language).
  const [randomIdeas, setRandomIdeas] = useState(() => getRandomIdeas(4));
  useEffect(() => {
    const handler = () => setRandomIdeas(getRandomIdeas(4));
    window.addEventListener("memap-language-changed", handler);
    return () => window.removeEventListener("memap-language-changed", handler);
  }, []);
  const [ideasDismissed, setIdeasDismissed] = useState(() => localStorage.getItem("memap_ideas_dismissed") === "true");
  // Notification opt-in banner. Shows when notifs aren't enabled and the
  // user hasn't dismissed the prompt. Hidden forever after dismiss —
  // they can still enable from Settings → Daily Reminders.
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(
    () => localStorage.getItem("memap_notif_banner_dismissed") === "true"
  );
  const [notifsEnabled, setNotifsEnabled] = useState(
    () => getNotificationSettings().enabled
  );

  useEffect(() => {
    const sync = () => setIdeasDismissed(localStorage.getItem("memap_ideas_dismissed") === "true");
    window.addEventListener("memap-settings-changed", sync);
    return () => window.removeEventListener("memap-settings-changed", sync);
  }, []);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTracker, setDuplicateTracker] = useState<Tracker | null>(null);
  const [pendingTracker, setPendingTracker] = useState<Tracker | null>(null);
  // Multi-select mode for the regular tracker list. When on, tapping a
  // card toggles its selection instead of opening its details, and a
  // bottom action bar shows "Удалить (N)" / "Готово". Lets the user
  // wipe several onboarding cards at once instead of opening each one.
  // Play trackers stay outside this mode — they have their own
  // ✓/× per-card buttons + "Удалить все игровые" action.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrackerIds, setSelectedTrackerIds] = useState<Set<string>>(new Set());
  const [selectedTrackerForDetails, setSelectedTrackerForDetails] = useState<Tracker | null>(null);
  const [selectedTrackerIndex, setSelectedTrackerIndex] = useState<number>(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackerToDelete, setTrackerToDelete] = useState<Tracker | null>(null);
  const [addTrackerModalOpen, setAddTrackerModalOpen] = useState(false);
  const [dailySessionOpen, setDailySessionOpen] = useState(false);
  // When true, the next session opens in random-play mode (10 random new
  // templates, saved as source="play" trackers). Reset after the session
  // closes so the next manual ▶ tap goes back to normal mode.
  const [playMode, setPlayMode] = useState(false);
  // Nonce that bumps every time the user starts a new play round. Used
  // as part of DailySession's `key` so a fresh deck is built even when
  // the user re-enters play mode while playMode was already true.
  const [playRoundNonce, setPlayRoundNonce] = useState(0);

  // Selected date for viewing/editing entries (default: today)
  const [selectedDate, setSelectedDate] = useState(() => 
    new Date().toISOString().split("T")[0]
  );

  const today = new Date().toISOString().split("T")[0];
  const isViewingToday = selectedDate === today;

  useEffect(() => {
    loadData();
  }, []);

  // Auto-close any open swipe-reveal rows whenever a modal/sheet
  // opens on top — otherwise an open card peeks out behind the
  // dimmed backdrop and ruins the focus of the modal (the user's
  // "things spill out of bounds" complaint when adding a tracker
  // and seeing a swiped card behind the duplicate-detection
  // dialog). Outside-click in the rows would catch most cases via
  // the tap that triggered the modal, but this is belt-and-braces.
  useEffect(() => {
    if (
      addTrackerModalOpen ||
      sheetOpen ||
      dailySessionOpen ||
      deleteDialogOpen ||
      duplicateDialogOpen
    ) {
      window.dispatchEvent(new Event("memap-close-swipe-rows"));
    }
  }, [
    addTrackerModalOpen,
    sheetOpen,
    dailySessionOpen,
    deleteDialogOpen,
    duplicateDialogOpen,
  ]);

  // Re-pull entries whenever another view (TrackerDetails, calendar, session)
  // persists a change. Keeps Today's Yes/No pills in sync after edits.
  useEffect(() => {
    const sync = () => { loadData(); };
    const openSession = (e: Event) => {
      // If the open-session event carries a play-mode hint (e.g. coming
      // back from Notes that was launched from a play round), enter play
      // mode with a fresh nonce so a new round starts.
      const detail = (e as CustomEvent).detail as { play?: boolean } | undefined;
      if (detail?.play) {
        setPlayMode(true);
        setPlayRoundNonce((n) => n + 1);
      }
      setDailySessionOpen(true);
    };
    const scrollToPlay = () => {
      // Wait a tick so trackers have re-rendered after a play round.
      setTimeout(() => {
        const el = document.getElementById("play-round-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    };
    window.addEventListener("memap-entries-changed", sync);
    window.addEventListener("memap-trackers-changed", sync);
    // Index dispatches this on cold launch when there are unanswered
    // questions for today, and TodayTab dispatches it from the session card.
    // Both paths land here so DailySession ownership stays in TodayTab.
    window.addEventListener("memap-open-session", openSession);
    window.addEventListener("memap-scroll-to-play", scrollToPlay);
    return () => {
      window.removeEventListener("memap-entries-changed", sync);
      window.removeEventListener("memap-trackers-changed", sync);
      window.removeEventListener("memap-open-session", openSession);
      window.removeEventListener("memap-scroll-to-play", scrollToPlay);
    };
  }, []);

  const loadData = async () => {
    const [trackersData, entriesData] = await Promise.all([
      getTrackers(),
      getEntries(),
    ]);
    // Filter archived FIRST so the Cards screen never shows archived
    // trackers — they live in Settings → Trackers (eye toggle) only.
    // Without this, archiving via the swipe-reveal silently bounced
    // back: archiveTrackerById set local state to the filtered list,
    // but saveTrackers fired memap-trackers-changed, which triggered
    // loadData (without the filter), re-pulling the archived tracker
    // into state and putting the row right back on screen.
    const visibleTrackers = trackersData.filter((t) => !t.archived);
    const sortedTrackers = [...visibleTrackers].sort((a, b) => {
      if (a.sortIndex !== undefined && b.sortIndex !== undefined) {
        return a.sortIndex - b.sortIndex;
      }
      if (a.sortIndex !== undefined) return -1;
      if (b.sortIndex !== undefined) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    setTrackers(sortedTrackers);
    setEntries(entriesData);
    setLoading(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = trackers.findIndex((t) => t.id === active.id);
      const newIndex = trackers.findIndex((t) => t.id === over.id);

      const newTrackers = arrayMove(trackers, oldIndex, newIndex);
      const trackersWithIndex = newTrackers.map((t, index) => ({
        ...t,
        sortIndex: index,
      }));

      setTrackers(trackersWithIndex);
      await saveTrackers(trackersWithIndex);
    }
  };

  const getSelectedDateEntry = (trackerId: string) => {
    return entries.find(
      (e) => e.trackerId === trackerId && e.date === selectedDate
    );
  };

  const datesWithEntries = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.date)));
  }, [entries]);

  // Remove an entry for (trackerId, date). Used by DailySession's
  // smart Undo button — popping the saved Yes/No so the day reads
  // as truly un-answered (notifications fire later, calendar dot
  // disappears, threshold count decrements). Best-effort error
  // handling: any storage failure surfaces as a toast but doesn't
  // block the UI which has already optimistically updated.
  const handleClearEntryForDate = async (trackerId: string, date: string) => {
    const updatedEntries = entries.filter(
      (e) => !(e.trackerId === trackerId && e.date === date),
    );
    setEntries(updatedEntries);
    try {
      await saveEntries(updatedEntries);
    } catch (err: any) {
      toast({
        title: t("today.saveFailed"),
        description: String(err?.message || err),
        variant: "destructive",
      });
    }
  };

  const handleAnswer = async (trackerId: string, value: boolean) => {
    const existingEntry = getSelectedDateEntry(trackerId);

    if (existingEntry) {
      const updatedEntries = entries.map((e) =>
        e.id === existingEntry.id ? { ...e, value } : e
      );
      setEntries(updatedEntries);
      try { await saveEntries(updatedEntries); }
      catch (err: any) {
        toast({ title: t("today.saveFailed"), description: String(err?.message || err), variant: "destructive" });
      }
    } else {
      const newEntry: TrackerEntry = {
        id: uuid(),
        trackerId,
        date: selectedDate,
        value,
      };
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      try { await saveEntries(updatedEntries); }
      catch (err: any) {
        toast({ title: t("today.saveFailed"), description: String(err?.message || err), variant: "destructive" });
      }

      if (isViewingToday) {
        const streak = calculateStreak(trackerId, updatedEntries);
        if (isStreakMilestone(streak.currentStreak)) {
          triggerConfetti();
        }
      }
    }

    // Notification queue refresh used to live here, gated on
    // isViewingToday. Now centralised in App.tsx via the
    // memap-entries-changed listener (saveEntries dispatches that
    // event), so EVERY entry write — Cards swipe, Play swipe,
    // calendar edit, undo, multi-select bulk — refreshes the queue
    // uniformly. One source of truth, no per-callsite plumbing.
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF'],
    });
  };

  const checkForDuplicate = (title: string, category: Tracker["category"]): Tracker | null => {
    const normalizedTitle = title.trim().toLowerCase();
    const duplicate = trackers.find(
      t => t.title.trim().toLowerCase() === normalizedTitle && 
           t.category === category &&
           !t.archived
    );
    return duplicate || null;
  };

  // Enable daily reminders inline from the Cards-screen banner. Asks
  // for permission, saves the default 20:00 time + enabled flag, and
  // schedules. On failure, surfaces a toast and leaves the banner so
  // the user can try again or go to Settings.
  const handleEnableNotifs = async () => {
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
    const current = getNotificationSettings();
    const next = { ...current, enabled: true };
    saveNotificationSettings(next);
    scheduleNotification(next);
    setNotifsEnabled(true);
    toast({ title: t("today.notifBannerEnabled") });
  };

  const handleDismissNotifBanner = () => {
    localStorage.setItem("memap_notif_banner_dismissed", "true");
    setNotifBannerDismissed(true);
  };

  const handleDismissIdeas = () => {
    localStorage.setItem("memap_ideas_dismissed", "true");
    setIdeasDismissed(true);
    toast({
      title: t("today.ideasHidden"),
      description: t("today.ideasHiddenDesc"),
      action: (
        <ToastAction
          altText={t("today.restore")}
          onClick={() => {
            localStorage.setItem("memap_ideas_dismissed", "false");
            setIdeasDismissed(false);
          }}
        >
          {t("today.restore")}
        </ToastAction>
      ),
    });
  };

  const createTrackerDirectly = async (newTracker: Tracker) => {
    const updatedTrackers = [...trackers, newTracker];
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
  };

  // Promote a play-round card to a regular tracker — drop the source
  // marker so it leaves the "Play round" section and joins normal cards.
  const promotePlayTracker = async (tracker: Tracker) => {
    const updated = trackers.map((t) =>
      t.id === tracker.id ? { ...t, source: undefined } : t
    );
    await saveTrackers(updated);
    setTrackers(updated);
    toast({
      title: t("today.playCardKept"),
      description: t("today.playCardKeptDesc", { title: localizeTrackerTitle(tracker.title) }),
    });
  };

  // Bulk-delete all play-marked trackers + their entries. Heavy hammer,
  // confirmed via toast undo so accidental taps are recoverable.
  const deleteAllPlayCards = async () => {
    const playIds = new Set(
      trackers.filter((t) => t.source === "play").map((t) => t.id)
    );
    if (playIds.size === 0) return;
    const previousTrackers = trackers;
    const previousEntries = entries;
    const updatedTrackers = trackers.filter((t) => !playIds.has(t.id));
    const updatedEntries = entries.filter((e) => !playIds.has(e.trackerId));
    setTrackers(updatedTrackers);
    setEntries(updatedEntries);
    await saveTrackers(updatedTrackers);
    await saveEntries(updatedEntries);
    toast({
      title: t("today.playRoundCleared"),
      description: t("today.playRoundClearedDesc", { count: playIds.size }),
      action: (
        <ToastAction
          altText={t("today.undo")}
          onClick={async () => {
            await saveTrackers(previousTrackers);
            await saveEntries(previousEntries);
            setTrackers(previousTrackers);
            setEntries(previousEntries);
          }}
        >
          {t("today.undo")}
        </ToastAction>
      ),
    });
  };

  const handleAddIdea = async (idea: any) => {
    const duplicate = checkForDuplicate(idea.title, idea.category);
    
    if (duplicate) {
      const newTracker: Tracker = {
        id: uuid(),
        title: idea.title,
        questionText: idea.questionText,
        category: idea.category,
        answerType: idea.answerType || "boolean",
        periodDays: idea.periodDays,
        threshold: idea.threshold,
        problemWhen: idea.problemWhen,
        adviceAboveThreshold: idea.adviceAboveThreshold,
        createdAt: new Date().toISOString(),
      };
      
      setPendingTracker(newTracker);
      setDuplicateTracker(duplicate);
      setDuplicateDialogOpen(true);
      return;
    }

    const newTracker: Tracker = {
      id: uuid(),
      title: idea.title,
      questionText: idea.questionText,
      category: idea.category,
      answerType: idea.answerType || "boolean",
      periodDays: idea.periodDays,
      threshold: idea.threshold,
      problemWhen: idea.problemWhen,
      adviceAboveThreshold: idea.adviceAboveThreshold,
      createdAt: new Date().toISOString(),
    };

    await createTrackerDirectly(newTracker);
    toast({ title: t("today.trackerAdded"), description: t("today.trackerAddedDesc", { title: localizeTrackerTitle(newTracker.title) }) });
  };

  const handleOpenExisting = () => {
    setDuplicateDialogOpen(false);
    if (duplicateTracker) {
      const index = trackers.findIndex(t => t.id === duplicateTracker.id);
      setSelectedTrackerForDetails(duplicateTracker);
      setSelectedTrackerIndex(index >= 0 ? index : 0);
      setSheetOpen(true);
    }
  };

  const handleCreateAnyway = async () => {
    setDuplicateDialogOpen(false);
    if (pendingTracker) {
      await createTrackerDirectly(pendingTracker);
      toast({ title: t("today.trackerAdded"), description: t("today.trackerAddedDesc", { title: localizeTrackerTitle(pendingTracker.title) }) });
      setPendingTracker(null);
      setDuplicateTracker(null);
    }
  };

  // Internal — archive any tracker by id. Toast with undo. Used by
  // both the existing TrackerDetails action and the new swipe-reveal
  // archive action on the Cards list.
  const archiveTrackerById = async (archivedId: string) => {
    const target = trackers.find((t) => t.id === archivedId);
    if (!target) return;
    const archivedTitle = localizeTrackerTitle(target.title);
    const updatedTrackers = trackers.map((t) =>
      t.id === archivedId ? { ...t, archived: true } : t,
    );
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers.filter((t) => !t.archived));

    // Toast with undo. Archive feels destructive ("my card disappeared!")
    // and the storage location (Settings → Trackers, eye toggle) isn't
    // discoverable on its own. The toast does double duty: tells the
    // user where it lives now, and gives a one-tap undo so an
    // accidental archive doesn't require hunting through Settings.
    toast({
      title: t("today.archivedToastTitle", { title: archivedTitle }),
      description: t("today.archivedToastDesc"),
      action: (
        <ToastAction
          altText={t("today.archivedToastUndo")}
          onClick={async () => {
            // Restore the same tracker from the most recent saved
            // copy. We re-read from storage rather than relying on
            // closures so the undo works even if other edits happened
            // in the meantime.
            const fresh = await getTrackers();
            const restored = fresh.map((tr) =>
              tr.id === archivedId ? { ...tr, archived: false } : tr,
            );
            await saveTrackers(restored);
            setTrackers(restored.filter((tr) => !tr.archived));
          }}
        >
          {t("today.archivedToastUndo")}
        </ToastAction>
      ),
    });
  };

  // Archive flow used from TrackerDetails — closes the sheet, then
  // delegates to the internal archive-by-id helper.
  const handleArchiveTracker = async () => {
    if (!selectedTrackerForDetails) return;
    const id = selectedTrackerForDetails.id;
    setSheetOpen(false);
    setSelectedTrackerForDetails(null);
    await archiveTrackerById(id);
  };

  const handleDeleteTracker = async () => {
    if (!trackerToDelete) return;
    const deleted = trackerToDelete;
    const previousTrackers = trackers;
    const updatedTrackers = trackers.filter(t => t.id !== deleted.id);
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
    setDeleteDialogOpen(false);
    setSheetOpen(false);
    setSelectedTrackerForDetails(null);
    setTrackerToDelete(null);

    toast({
      title: t("today.trackerDeleted"),
      description: t("today.trackerDeletedDesc", { title: localizeTrackerTitle(deleted.title) }),
      action: (
        <ToastAction
          altText={t("today.undo")}
          onClick={async () => {
            const allTrackers = await getTrackers();
            const restored = [...allTrackers.filter(t => t.id !== deleted.id), deleted];
            await saveTrackers(restored);
            setTrackers(previousTrackers);
          }}
        >
          {t("today.undo")}
        </ToastAction>
      ),
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTrackerIds(new Set());
  };

  const toggleTrackerSelection = (id: string) => {
    setSelectedTrackerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedTrackerIds);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const previousTrackers = trackers;
    const deleted = trackers.filter((t) => idSet.has(t.id));
    const updatedTrackers = trackers.filter((t) => !idSet.has(t.id));
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
    exitSelectionMode();

    toast({
      title:
        ids.length === 1
          ? t("today.trackerDeleted")
          : t("today.bulkDeletedTitle", { count: ids.length }),
      description: t("today.bulkDeletedDesc"),
      action: (
        <ToastAction
          altText={t("today.undo")}
          onClick={async () => {
            const allTrackers = await getTrackers();
            // Restore by union with what's currently saved (in case
            // entries were edited in the meantime).
            const stillThere = new Set(allTrackers.map((tr) => tr.id));
            const restored = [
              ...allTrackers,
              ...deleted.filter((tr) => !stillThere.has(tr.id)),
            ];
            await saveTrackers(restored);
            setTrackers(previousTrackers);
          }}
        >
          {t("today.undo")}
        </ToastAction>
      ),
    });
  };

  const handleUpdateTracker = async (updatedTracker: Tracker) => {
    const updatedTrackers = trackers.map(t =>
      t.id === updatedTracker.id ? updatedTracker : t
    );
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
    setSelectedTrackerForDetails(updatedTracker);
  };

  const handleOpenTrackerDetails = (tracker: Tracker) => {
    const index = trackers.findIndex(t => t.id === tracker.id);
    setSelectedTrackerForDetails(tracker);
    setSelectedTrackerIndex(index >= 0 ? index : 0);
    setSheetOpen(true);
  };

  const handleNavigateTracker = (direction: "prev" | "next") => {
    let newIndex = selectedTrackerIndex;
    if (direction === "prev" && selectedTrackerIndex > 0) {
      newIndex = selectedTrackerIndex - 1;
    } else if (direction === "next" && selectedTrackerIndex < trackers.length - 1) {
      newIndex = selectedTrackerIndex + 1;
    }
    setSelectedTrackerIndex(newIndex);
    setSelectedTrackerForDetails(trackers[newIndex]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (trackers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6 -mt-12">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Play className="h-9 w-9 text-primary ml-1" strokeWidth={1.75} fill="currentColor" />
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-serif font-medium">{t("today.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {t("today.emptyHint")}
          </p>
        </div>
        <Button
          onClick={() => setAddTrackerModalOpen(true)}
          className="rounded-full px-6"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("today.addFirst")}
        </Button>
        
        <AddTrackerModal
          open={addTrackerModalOpen}
          onClose={() => setAddTrackerModalOpen(false)}
          onTrackerAdded={loadData}
        />
      </div>
    );
  }

  const globalStreak = calculateGlobalStreak(entries);
  const selectedDateObj = new Date(selectedDate + "T00:00:00");
  const isSelectedDateToday = isToday(selectedDateObj);

  return (
    <div className="space-y-6">
      {/* Daily Session Mode. The "see my patterns" exit on the completion
          screen needs Index to swap the active tab — we dispatch
          `memap-switch-tab` and Index listens. */}
      {dailySessionOpen && (
        <DailySession
          trackers={trackers}
          entries={entries}
          selectedDate={selectedDate}
          onAnswer={handleAnswer}
          onClearAnswer={handleClearEntryForDate}
          onClose={() => {
            setDailySessionOpen(false);
            setPlayMode(false);
          }}
          onComplete={() => {
            setDailySessionOpen(false);
            setPlayMode(false);
            loadData();
          }}
          onGoToPatterns={() => {
            setDailySessionOpen(false);
            setPlayMode(false);
            loadData();
            window.dispatchEvent(
              new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } })
            );
          }}
          onDateChange={setSelectedDate}
          onPlayRandom={() => {
            // Bump the nonce so DailySession remounts with a fresh deck
            // even if playMode was already true (e.g. "play another round"
            // from the play-mode Done screen).
            setPlayMode(true);
            setPlayRoundNonce((n) => n + 1);
          }}
          playMode={playMode}
          // Re-mount the session whenever play mode turns on or a new
          // round is requested, so each round gets a fresh shuffle.
          key={playMode ? `play-${playRoundNonce}` : "normal"}
        />
      )}

      {/* Header row: streak chip on the left, action buttons on the
          right. The streak chip is ALWAYS rendered (even at 0) so the
          left side never looks empty and the user always knows where
          to find their streak. */}
      <div className="animate-fade-in space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              globalStreak.currentStreak > 0
                ? "bg-gradient-to-br from-orange-500/15 to-orange-600/5 border-orange-500/20"
                : "bg-muted/30 border-border/40"
            }`}
            title={globalStreak.currentStreak > 0
              ? undefined
              : t("today.streakStartHint")}
          >
            <Flame
              className={`h-3.5 w-3.5 ${globalStreak.currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`}
              strokeWidth={2}
              fill={globalStreak.currentStreak > 0 ? "currentColor" : "none"}
            />
            <span className="text-xs font-medium text-foreground">
              <span className="font-serif text-sm font-semibold tabular-nums">{globalStreak.currentStreak}</span>
              <span className="text-muted-foreground ml-1">
                {globalStreak.currentStreak === 1
                  ? t("today.streakDaysOne")
                  : t("today.streakDaysMany", { count: globalStreak.currentStreak })}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Always-accessible Random Play — opens the session in play
                mode straight away, no need to wait for the Done screen. */}
            <button
              data-coachmark="shuffle-button"
              onClick={() => {
                setPlayMode(true);
                setPlayRoundNonce((n) => n + 1);
                setDailySessionOpen(true);
              }}
              aria-label={t("today.playRandomAria")}
              className="h-8 w-8 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              title={t("today.playRandom")}
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              data-coachmark="notes-link"
              onClick={() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} }))}
              className="text-xs px-3 py-1.5 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("common.notesLink")}
            </button>
            <Button
              data-coachmark="add-button"
              size="sm"
              onClick={() => setAddTrackerModalOpen(true)}
              className="rounded-full px-3 h-8"
              aria-label={t("common.addPattern")}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("today.addNew")}
            </Button>
          </div>
        </div>
      </div>

      {/* Notif opt-in banner — shown only when reminders are off and
          the user hasn't dismissed the prompt. Tucked between the
          header and Ideas of the Day so it gets noticed without
          dominating the page. */}
      {!notifsEnabled && !notifBannerDismissed && trackers.length > 0 && (
        <div className="card-premium p-3 flex items-start gap-3 animate-fade-in">
          <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">
              {t("today.notifBannerTitle")}
            </p>
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              {t("today.notifBannerBody")}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <Button
                size="sm"
                onClick={handleEnableNotifs}
                className="rounded-full h-7 px-3 text-xs"
              >
                {t("today.notifBannerEnable")}
              </Button>
              <button
                onClick={handleDismissNotifBanner}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors px-2 py-1"
              >
                {t("today.notifBannerDismiss")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ideas of the Day Banner */}
      {randomIdeas.length > 0 && !ideasDismissed && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{t("today.ideasOfTheDay")}</p>
            <button
              onClick={handleDismissIdeas}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              aria-label={t("today.hideIdeas")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative px-1">
            <Carousel
              opts={{
                align: "start",
                loop: true,
                skipSnaps: false,
                dragFree: false,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-3">
                {randomIdeas.map((idea: any, index) => (
                  <CarouselItem key={idea.id} className="pl-3 basis-[270px] sm:basis-[290px]">
                    <Card
                      className="h-[115px] flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-1 bg-muted/30 border-muted/50 shadow-sm"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-3.5 flex flex-col h-full">
                        <div className="flex items-start gap-2.5 mb-auto">
                          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" strokeWidth={1.75} />
                          <p className="text-xs font-medium leading-relaxed line-clamp-3 flex-1 text-muted-foreground">
                            {idea.questionText}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddIdea(idea)}
                          className="w-full text-xs rounded-full h-7 mt-2 bg-background/50 hover:bg-background border-muted-foreground/20 hover:border-muted-foreground/40"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("today.addToMyMap")}
                        </Button>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 h-8 w-8" />
              <CarouselNext className="right-0 translate-x-1/2 top-1/2 -translate-y-1/2 h-8 w-8" />
            </Carousel>
          </div>
        </div>
      )}

      {/* Tracker list — Cards mode. Split into regular cards and
          "Play round" cards (created by random-play mode). Play cards
          live in their own section so users can prune/promote them
          without polluting their real tracking surface. */}
      {(() => {
        // Belt-and-braces: also exclude archived here even though
        // loadData should have already filtered them out. Defends
        // against any future code path that puts an archived tracker
        // into state without going through loadData.
        const regularTrackers = trackers.filter((tr) => tr.source !== "play" && !tr.archived);
        const playTrackers = trackers.filter((tr) => tr.source === "play" && !tr.archived);

        const renderTrackerCard = (tracker: Tracker, isPlay: boolean) => {
          const TIcon = getTrackerIcon(tracker.title, tracker.category);
          const todayEntry = getSelectedDateEntry(tracker.id);
          const answered = todayEntry !== undefined;
          // Selection mode only applies to regular cards. Play cards
          // keep their own ✓/× row so the user can promote-or-delete
          // them one at a time without losing that affordance.
          const inSelectMode = selectionMode && !isPlay;
          const isSelected = selectedTrackerIds.has(tracker.id);
          return (
            <Card
              key={tracker.id}
              onClick={() => {
                if (inSelectMode) {
                  toggleTrackerSelection(tracker.id);
                } else {
                  handleOpenTrackerDetails(tracker);
                }
              }}
              className={cn(
                "card-premium cursor-pointer hover:shadow-md transition-all active:scale-[0.99]",
                inSelectMode && isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
            >
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-muted/40 flex items-center justify-center flex-shrink-0">
                  <TIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{localizeTrackerTitle(tracker.title)}</p>
                  {tracker.questionText && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {localizeTrackerQuestion(tracker.questionText)}
                    </p>
                  )}
                </div>
                {inSelectMode ? (
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                  </div>
                ) : isPlay ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        promotePlayTracker(tracker);
                      }}
                      aria-label={t("today.keepPlayCard")}
                      className="h-7 w-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackerToDelete(tracker);
                        setDeleteDialogOpen(true);
                      }}
                      aria-label={t("today.deletePlayCard")}
                      className="h-7 w-7 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      answered ? "bg-primary" : "bg-muted-foreground/20"
                    }`}
                    aria-label={answered ? t("today.answeredToday") : t("today.notAnsweredToday")}
                  />
                )}
              </CardContent>
            </Card>
          );
        };

        return (
          <>
            {regularTrackers.length > 0 && (
              <div data-coachmark="cards-list" className="space-y-3 animate-fade-in">
                {/* Selection-mode header. When OFF, show a small "Изменить"
                    action so the user can enter bulk-edit mode. When ON,
                    show selected count + Cancel + Delete (N).
                    Hidden when there's only 1 regular tracker — bulk
                    select is overkill for a single item. */}
                {regularTrackers.length > 1 && (
                  <div className="flex items-center justify-between -mb-1">
                    {selectionMode ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {selectedTrackerIds.size === 0
                            ? t("today.selectionModeHint")
                            : t("today.selectionCount", { count: selectedTrackerIds.size })}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={exitSelectionMode}
                            className="text-xs rounded-full h-7 px-3"
                          >
                            {t("common.cancel")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBulkDelete}
                            disabled={selectedTrackerIds.size === 0}
                            className="text-xs rounded-full h-7 px-3 text-destructive hover:bg-destructive/10 disabled:text-muted-foreground"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {selectedTrackerIds.size > 0
                              ? t("today.bulkDeleteAction", { count: selectedTrackerIds.size })
                              : t("today.bulkDeleteEmpty")}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                          {t("today.cardsSection")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectionMode(true)}
                          className="text-xs rounded-full h-7 px-3 text-muted-foreground hover:text-foreground"
                        >
                          <ListChecks className="h-3 w-3 mr-1" />
                          {t("today.editCards")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {regularTrackers.map((tracker) => (
                    <SwipeRevealRow
                      key={tracker.id}
                      onArchive={() => archiveTrackerById(tracker.id)}
                      onDelete={() => {
                        setTrackerToDelete(tracker);
                        setDeleteDialogOpen(true);
                      }}
                      // Selection mode owns the tap target — disable
                      // swipe-reveal so the user doesn't accidentally
                      // open the action panel while trying to tick a
                      // checkbox.
                      disabled={selectionMode}
                    >
                      {renderTrackerCard(tracker, false)}
                    </SwipeRevealRow>
                  ))}
                </div>
              </div>
            )}

            {playTrackers.length > 0 && (
              <div id="play-round-section" className="space-y-3 animate-fade-in scroll-mt-20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      🎲 {t("today.playRoundSection")}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {t("today.playRoundHint")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAllPlayCards()}
                    className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full px-3 h-8"
                  >
                    {t("today.deleteAllPlay")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {playTrackers.map((tracker) => renderTrackerCard(tracker, true))}
                </div>
              </div>
            )}
          </>
        );
      })()}
      
      <DuplicateTrackerDialog
        open={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        existingTracker={duplicateTracker}
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={handleCreateAnyway}
      />

      {/* Bottom Sheet for Tracker Details. Header is now minimal —
          stats, advice and management actions live inside the body so
          the user sees everything important without scrolling and
          doesn't have to hit a tiny icon at the top. */}
      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        className="h-[80vh]"
        ariaTitle={selectedTrackerForDetails ? localizeTrackerTitle(selectedTrackerForDetails.title) : "Tracker details"}
      >
        {/* Body opts out of vaul drag so internal scroll is unimpeded.
            Dismiss-by-drag still works from the pill / top region. */}
        <div className="flex-1 overflow-y-auto">
          {selectedTrackerForDetails && (
            <div className="mt-2">
              <TrackerDetails
                tracker={selectedTrackerForDetails}
                trackers={trackers}
                currentIndex={selectedTrackerIndex}
                onNavigateTracker={handleNavigateTracker}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                onEdit={() => setSettingsModalOpen(true)}
                onArchive={handleArchiveTracker}
                onDelete={() => {
                  setTrackerToDelete(selectedTrackerForDetails);
                  setDeleteDialogOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Tracker Settings Modal */}
      {selectedTrackerForDetails && (
        <TrackerSettingsModal
          open={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          tracker={selectedTrackerForDetails}
          onSave={handleUpdateTracker}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("today.deleteConfirmTitle", { title: trackerToDelete ? localizeTrackerTitle(trackerToDelete.title) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("today.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTracker} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tracker Modal */}
      <AddTrackerModal
        open={addTrackerModalOpen}
        onClose={() => setAddTrackerModalOpen(false)}
        onTrackerAdded={loadData}
        onNavigateToTracker={(tracker) => {
          handleOpenTrackerDetails(tracker);
        }}
      />
    </div>
  );
};

// Sortable wrapper for SwipeableTrackerCard
interface SortableSwipeCardProps {
  tracker: Tracker;
  selectedDateEntry: TrackerEntry | undefined;
  onAnswer: (trackerId: string, value: boolean) => void;
  onOpenDetails: (tracker: Tracker) => void;
  onDelete?: (tracker: Tracker) => void;
}

const SortableSwipeCard = ({ tracker, selectedDateEntry, onAnswer, onOpenDetails, onDelete }: SortableSwipeCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tracker.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SwipeableTrackerCard
        tracker={tracker}
        selectedDateEntry={selectedDateEntry}
        onAnswer={onAnswer}
        onOpenDetails={onOpenDetails}
        onDelete={onDelete}
        dragHandleProps={listeners}
        isDragging={isDragging}
      />
    </div>
  );
};

// --- SwipeRevealRow -------------------------------------------------
// Telegram-chat style row: swipe LEFT and two action buttons
// (archive, delete) appear, growing from width 0 in step with the
// finger. When the user isn't swiping, the buttons aren't there at
// all (zero width) so there's no peek-through behind the card's
// rounded corners. Outer wrapper is rounded + overflow-hidden so the
// reveal panel inherits the card's silhouette.
//
// Behaviour:
//   - As the user pulls left, both transform AND reveal-panel width
//     update on every pointermove → the card and the buttons stretch
//     together with the finger (no gap appears between them).
//   - On release: < 50 % pulled → snap closed (both ease back to 0).
//                 ≥ 50 % pulled → snap open at the full 144 px reveal.
//   - Tap on card body (no movement) → if open, close; otherwise the
//     inner card handles it (open details).
//   - Selection mode disables the gesture entirely so taps select
//     instead of swiping.

interface SwipeRevealRowProps {
  children: React.ReactNode;
  onArchive: () => void;
  onDelete: () => void;
  /** Disable the gesture entirely (e.g. while in selection mode). */
  disabled?: boolean;
}

const REVEAL_DISTANCE = 144; // 2 buttons × 72 px

// Singleton-ish ID for the currently-open row. When a row opens it
// dispatches a `memap-swipe-row-opened` event with its id; every other
// row that's open at the time closes itself in response. Result: only
// one row is open at a time, like Telegram. Stable per mount.
let _swipeRowSeq = 0;

const SwipeRevealRow = ({ children, onArchive, onDelete, disabled }: SwipeRevealRowProps) => {
  const { t } = useTranslation();
  const [offsetX, setOffsetX] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  // isDragging gates CSS transitions: while the finger drives the
  // animation we want immediate 1:1 movement (no tween lag), and on
  // release the transition kicks in for a smooth snap.
  const [isDragging, setIsDragging] = React.useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const startX = React.useRef(0);
  // startY tracks the touch's vertical origin so we can decide
  // direction on the first few pointermoves. If motion is vertical-
  // dominant we yield to iOS native scroll (pan-y on the outer); only
  // a clearly horizontal-dominant move captures the pointer for our
  // reveal gesture. This is exactly how Telegram chat rows behave —
  // smooth vertical list scrolling, with horizontal-only swipes
  // claiming the gesture.
  const startY = React.useRef(0);
  const currentDx = React.useRef(0);
  const activePointerId = React.useRef<number | null>(null);
  const hasCaptured = React.useRef(false);
  const startedFromOpen = React.useRef(false);
  // Stable per-row id used to suppress self-trigger of the
  // "another row opened" close event.
  const rowId = React.useRef(++_swipeRowSeq);

  const close = () => {
    setOffsetX(0);
    setIsOpen(false);
  };

  // Auto-close when context changes around the row:
  //   • pointerdown anywhere outside the row (taps on a modal, on
  //     another card, on the nav bar — anything off-row)
  //   • the page scrolls (any scroll container, captured at root)
  //   • another swipe-row opens (only one at a time, Telegram-style)
  //   • a modal/dialog explicitly tells everyone to close (custom
  //     `memap-close-swipe-rows` event — fired by AddTrackerModal et al.
  //     so the open row doesn't peek behind the dimmed backdrop, which
  //     was the user's "all spills out of bounds" complaint).
  React.useEffect(() => {
    if (!isOpen) return;

    const onOutsidePointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (rowRef.current && target && !rowRef.current.contains(target)) {
        close();
      }
    };
    const onScroll = () => close();
    const onAnotherRowOpened = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: number } | undefined;
      if (detail?.id !== rowId.current) close();
    };
    const onCloseAll = () => close();

    window.addEventListener("pointerdown", onOutsidePointer);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("memap-swipe-row-opened", onAnotherRowOpened);
    window.addEventListener("memap-close-swipe-rows", onCloseAll);

    return () => {
      window.removeEventListener("pointerdown", onOutsidePointer);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("memap-swipe-row-opened", onAnotherRowOpened);
      window.removeEventListener("memap-close-swipe-rows", onCloseAll);
    };
  }, [isOpen]);

  // Announce when this row opens so its siblings close themselves.
  React.useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(
        new CustomEvent("memap-swipe-row-opened", { detail: { id: rowId.current } }),
      );
    }
  }, [isOpen]);

  // Native non-passive touchmove listener that actively kills any
  // iOS-engaged pan-y scroll once we've claimed the gesture as
  // horizontal. React's onPointerMove is passive — preventDefault
  // there is a no-op — so without this hook iOS would keep panning
  // the page vertically for those first few px before our pointer-
  // capture took effect, which the user perceived as the screen
  // wiggling. Mirrors the same trick used in OverviewCard's calendar
  // tracker-swipe.
  React.useEffect(() => {
    const node = rowRef.current;
    if (!node || disabled) return;
    const onTouchMove = (e: TouchEvent) => {
      if (hasCaptured.current) {
        // We own the gesture → stop iOS from continuing any scroll
        // it may have started in the first 4 px before we claimed.
        e.preventDefault();
      }
    };
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      node.removeEventListener("touchmove", onTouchMove);
    };
  }, [disabled]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    // If touch starts on an action button, let it handle its own click.
    if (target.closest("[data-swipe-action]")) return;
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    // Do NOT capture yet — we want iOS to handle vertical pan
    // natively (smooth, momentum-aware scroll of the cards list).
    // We claim the pointer in pointermove only when motion is
    // clearly horizontal-dominant; vertical-dominant motion yields
    // to native scroll.
    hasCaptured.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentDx.current = 0;
    startedFromOpen.current = isOpen;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // Direction-decision phase — wait for unambiguous motion, then
    // either claim (horizontal) or yield (vertical). Threshold and
    // ratio tuned tight (4 px / 1.2×) on purpose: iOS engages native
    // pan-y scroll around 8-10 px of vertical motion, so we have to
    // commit a horizontal claim BEFORE that to stop the page from
    // wiggling underneath the swipe (the user's "the whole screen
    // shakes when I'm pulling the card" complaint). Stricter
    // numbers wouldn't catch slight diagonal flicks, looser ones
    // would steal vertical scrolls.
    if (!hasCaptured.current) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 4 && absDy < 4) return; // not enough motion yet
      if (absDx > absDy * 1.2) {
        // Horizontal-dominant → claim the pointer; subsequent moves
        // route to us regardless of where the finger ends up. Native
        // scroll won't engage on this gesture anymore. The native
        // touchmove listener (registered in the effect below) will
        // also start preventDefault'ing on the underlying touch
        // events to actively kill any nascent iOS scroll.
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        hasCaptured.current = true;
        setIsDragging(true);
      } else {
        // Vertical or ambiguous → yield. iOS continues its native
        // pan-y scroll uninterrupted. Mark the gesture as no-longer-
        // ours so subsequent moves are ignored.
        activePointerId.current = null;
        return;
      }
    }

    currentDx.current = dx;
    // Compute current offset relative to the open/closed state.
    const base = startedFromOpen.current ? -REVEAL_DISTANCE : 0;
    // Hard-clamp slightly past the reveal so a strong pull just
    // bounces against the wall instead of revealing more buttons.
    const next = Math.min(0, Math.max(-REVEAL_DISTANCE - 24, base + dx));
    setOffsetX(next);
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    if (hasCaptured.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    hasCaptured.current = false;
    activePointerId.current = null;
    setIsDragging(false);

    // Decide settle state. Open if the user is clearly past 50 % of the
    // reveal distance, OR if they were already open and didn't pull
    // far enough rightward to close.
    if (offsetX < -REVEAL_DISTANCE / 2) {
      // Snap-to-open haptic — the row "clicks" into the revealed
      // state, giving the same tactile cue Telegram fires when its
      // chat-row swipe locks open. Only fires on the transition
      // from closed → open, not when the user pulled while already
      // open (we'd be re-snapping to the same position).
      if (!startedFromOpen.current) haptics.tap();
      setOffsetX(-REVEAL_DISTANCE);
      setIsOpen(true);
    } else {
      // Closing back from an open state also gets a tiny tick so the
      // user feels the row return home. Skip when starting from a
      // closed / mid-drag-cancel state — no real transition there.
      if (startedFromOpen.current) haptics.tap();
      close();
    }
  };

  // Reveal width follows the offset 1:1, capped at REVEAL_DISTANCE.
  // Drives the expanding action panel below.
  const revealWidth = Math.min(REVEAL_DISTANCE, Math.abs(offsetX));
  const transitionStyle = isDragging ? "none" : "transform 220ms ease-out, width 220ms ease-out";

  return (
    <div
      ref={rowRef}
      // The OUTER wrapper carries the card's visual styling (via the
      // card-premium class) and rounding. The inner card has its
      // card-premium overridden to be transparent/borderless via the
      // .swipe-reveal-row CSS rule, so when the panel reveals there's
      // no visible seam between the card body and the action buttons
      // — both sit inside one continuous rounded silhouette.
      //
      // touch-action: pan-y — exactly Telegram's chat-row behaviour:
      // iOS keeps native vertical scroll (smooth list pan with
      // momentum and bounce, the user's main complaint with our
      // earlier touch-action:none version), while horizontal motion
      // is ours. Together with the pointermove direction-decision
      // (yield to vertical, claim on horizontal-dominant 1.5×) the
      // row never fights native scroll: scrolling the cards list
      // works as expected; deliberate horizontal pulls reveal the
      // archive/delete actions.
      className="swipe-reveal-row card-premium relative rounded-3xl overflow-hidden"
      style={{ touchAction: "pan-y" }}
    >
      {/* Action panel — width grows with the swipe so when offsetX is 0
          the panel literally has zero size and isn't rendered to any
          pixels. The buttons inside have flex-shrink-0 so they don't
          squeeze when the panel is partially open; they just get
          clipped by the panel's overflow-hidden. */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch overflow-hidden"
        style={{
          width: revealWidth,
          transition: transitionStyle,
        }}
        // Action panel itself doesn't intercept touches so a finger
        // dragged across it during a swipe stays with the row's
        // gesture. Buttons inside still get their click on tap.
      >
        <button
          type="button"
          data-swipe-action
          onClick={() => {
            // Medium thump for archive — significant action, not
            // destructive. Tap-tier feels too light for moving a
            // tracker out of view.
            haptics.medium();
            onArchive();
            close();
          }}
          className="w-[72px] flex-shrink-0 flex flex-col items-center justify-center bg-slate-500 text-white text-[10px] font-medium gap-0.5 active:bg-slate-600"
          aria-label={t("today.swipeArchive")}
        >
          <EyeOff className="h-4 w-4" strokeWidth={2} />
          {t("today.swipeArchive")}
        </button>
        <button
          type="button"
          data-swipe-action
          onClick={() => {
            // Warning pattern for delete — two-pulse, says "are you
            // sure?" tactically before the confirmation dialog
            // visually says it. Matches iOS guidance: destructive
            // actions deserve a warning haptic.
            haptics.warning();
            onDelete();
            close();
          }}
          className="w-[72px] flex-shrink-0 flex flex-col items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-medium gap-0.5 active:bg-destructive/90"
          aria-label={t("today.swipeDelete")}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          {t("today.swipeDelete")}
        </button>
      </div>

      {/* Card body. transform animates with the same easing as the
          panel width so the right edge of the card and the left edge
          of the panel stay glued together (they're both functions of
          offsetX). No gap is ever introduced. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClick={() => {
          // Tap on the row body (no movement) while the panel is open
          // = close it. The inner card's own onClick (open details)
          // still fires when closed because we only consume the click
          // when isOpen is true.
          if (isOpen && Math.abs(currentDx.current) < 5) {
            close();
          }
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: transitionStyle,
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
};
