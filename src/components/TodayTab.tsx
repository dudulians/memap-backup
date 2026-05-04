import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries, saveTrackers } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Settings as SettingsIcon, Play, X, Lightbulb, Flame, Shuffle, Bell, Trash2, Check, ListChecks } from "lucide-react";
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
  // Tracks whether the duplicate found is archived — drives the
  // dialog's CTA copy ("Restore from archive" vs. "Open existing").
  const [duplicateIsArchived, setDuplicateIsArchived] = useState(false);
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

  // Returns both active and archived matches. Active is preferred —
  // if both an active and an archived copy somehow coexist (shouldn't
  // happen, but safer to handle), the active one wins. The caller
  // uses `isArchived` to drive different dialog copy & CTAs (restore
  // from archive vs. open existing).
  const checkForDuplicate = async (
    title: string,
    category: Tracker["category"],
  ): Promise<{ tracker: Tracker; isArchived: boolean } | null> => {
    const normalizedTitle = title.trim().toLowerCase();
    // Read fresh from storage so archived ones (which aren't in our
    // local state — we filter them out in loadData) are still seen.
    const all = await getTrackers();
    const matches = all.filter(
      (t) =>
        t.title.trim().toLowerCase() === normalizedTitle &&
        t.category === category,
    );
    if (matches.length === 0) return null;
    const active = matches.find((t) => !t.archived);
    if (active) return { tracker: active, isArchived: false };
    return { tracker: matches[0], isArchived: true };
  };

  const restoreFromArchive = async (id: string) => {
    const all = await getTrackers();
    const restored = all.map((t) => (t.id === id ? { ...t, archived: false } : t));
    await saveTrackers(restored);
    setTrackers(restored.filter((t) => !t.archived));
    haptics.success();
    toast({
      title: t("today.restoredFromArchive"),
      description: t("today.restoredFromArchiveDesc"),
    });
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

  // Bulk-promote: drop the source="play" marker from every play-round
  // tracker so they all join the regular cards in one tap. Mirror image
  // of deleteAllPlayCards. Snapshot previous trackers so the toast can
  // offer Undo.
  const keepAllPlayCards = async () => {
    const playIds = new Set(
      trackers.filter((t) => t.source === "play").map((t) => t.id)
    );
    if (playIds.size === 0) return;
    const previousTrackers = trackers;
    const updatedTrackers = trackers.map((t) =>
      playIds.has(t.id) ? { ...t, source: undefined } : t
    );
    setTrackers(updatedTrackers);
    await saveTrackers(updatedTrackers);
    toast({
      title: t("today.playRoundKept"),
      description: t("today.playRoundKeptDesc", { count: playIds.size }),
      action: (
        <ToastAction
          altText={t("today.undo")}
          onClick={async () => {
            await saveTrackers(previousTrackers);
            setTrackers(previousTrackers);
          }}
        >
          {t("today.undo")}
        </ToastAction>
      ),
    });
  };

  const handleAddIdea = async (idea: any) => {
    const dup = await checkForDuplicate(idea.title, idea.category);

    if (dup) {
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
      setDuplicateTracker(dup.tracker);
      setDuplicateIsArchived(dup.isArchived);
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

  // Core delete flow. Removes the tracker, persists, shows the
  // undo toast. Used by both the confirm-dialog path (regular cards)
  // and the no-confirm path (play-round cards — see deletePlayCard).
  const performTrackerDelete = async (deleted: Tracker) => {
    const previousTrackers = trackers;
    const updatedTrackers = trackers.filter(t => t.id !== deleted.id);
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);

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

  const handleDeleteTracker = async () => {
    if (!trackerToDelete) return;
    const deleted = trackerToDelete;
    setDeleteDialogOpen(false);
    setSheetOpen(false);
    setSelectedTrackerForDetails(null);
    setTrackerToDelete(null);
    await performTrackerDelete(deleted);
  };

  // Play-card delete: skip the confirmation dialog entirely. Random-
  // round cards are throwaway by design — the user's mental model is
  // "swipe-discard"; an "Are you sure?" dialog after every X-tap was
  // friction. The undo toast is the safety net (5s window to bring
  // it back), which mirrors how the bulk "Clear all" works.
  const deletePlayCard = async (tracker: Tracker) => {
    await performTrackerDelete(tracker);
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
          onPlayRandom={async () => {
            // Refresh trackers from storage BEFORE building the next
            // round's deck. Without this, async tracker writes from
            // the round that just finished (handleAnswer fires-and-
            // forgets) might not have propagated to React state yet,
            // and the new deck would treat just-saved play trackers
            // as "doesn't exist" — re-suggesting the SAME template
            // the user just answered. User reported exactly this:
            // answered "no" to "thought-about-leaving" in round 1,
            // got it again in round 2, both copies stayed. Awaiting
            // loadData closes that race.
            await loadData();
            setPlayMode(true);
            setPlayRoundNonce((n) => n + 1);
          }}
          playMode={playMode}
          // Re-mount the session whenever play mode turns on or a new
          // round is requested, so each round gets a fresh shuffle.
          key={playMode ? `play-${playRoundNonce}` : "normal"}
        />
      )}

      {/* Header row: streak chip + action buttons. The streak chip
          is now hidden until 3 days of consecutive activity (1.7.2):
          showing "0 days in a row 🔥" on day one is demoralizing —
          a feedback loop that punishes blank state. From day 3 it
          appears with the orange gradient. Below 3 days the row
          starts with a placeholder chip "Start your streak today"
          that turns into the real streak as the user tracks. */}
      <div className="animate-fade-in space-y-3">
        <div className="flex items-center justify-between gap-2">
          {globalStreak.currentStreak >= 3 ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-gradient-to-br from-orange-500/15 to-orange-600/5 border-orange-500/20"
            >
              <Flame
                className="h-3.5 w-3.5 text-orange-500"
                strokeWidth={2}
                fill="currentColor"
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
          ) : (
            // Pre-streak placeholder — soft "encouragement" chip
            // instead of the empty "0 days" state that read as
            // failure.
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/30 border-border/40"
              title={t("today.streakStartHint")}
            >
              <Flame
                className="h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={2}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {globalStreak.currentStreak === 0
                  ? t("today.streakStartHint")
                  : t("today.streakDaysMany", { count: globalStreak.currentStreak })}
              </span>
            </div>
          )}
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
            {/* Conditional title (1.7.2): showing "Don't lose your
                streak" when the user HAS no streak yet (streak<3)
                is logically wrong — they have nothing to lose.
                Switch to a softer "build a daily habit" framing
                pre-streak. The "real" don't-lose-streak banner
                only appears once they're past day 3. */}
            <p className="text-sm font-medium leading-snug">
              {globalStreak.currentStreak >= 3
                ? t("today.notifBannerTitle")
                : t("today.notifBannerTitleStart")}
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
                align: "center",
                loop: true,
                skipSnaps: false,
                dragFree: false,
              }}
              className="w-full"
            >
              {/* Card width 88vw clamped to a sensible upper bound
                  on tablets — shows ONE full card with a small peek
                  of the next so the swipe affordance is visible.
                  Was basis-[270px] which caused mid-word clipping
                  on the right edge of the second card on iPhone. */}
              <CarouselContent className="-ml-3">
                {randomIdeas.map((idea: any, index) => (
                  <CarouselItem key={idea.id} className="pl-3 basis-[88%] sm:basis-[320px]">
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
                  {/* Question primary, title secondary — same hierarchy
                      as TrackerDetails. The user is here to answer
                      ("did I work out today?"), not to read a metric
                      label ("Тренировался"). Title still rendered as
                      a small breadcrumb so identity is preserved. The
                      question can wrap to 2 lines (line-clamp-2)
                      because long questions clipped to a single line
                      with "..." lose the qualifying details that
                      make the question unambiguous. */}
                  {tracker.questionText && (
                    <p className="font-medium text-sm leading-snug line-clamp-2">
                      {localizeTrackerQuestion(tracker.questionText)}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/80 truncate mt-1">
                    {localizeTrackerTitle(tracker.title)}
                  </p>
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
                        // Direct delete — no confirmation dialog.
                        // Throwaway play cards; undo toast is the safety net.
                        deletePlayCard(tracker);
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
                  {/* Plain list — swipe-reveal removed. Per-card
                      Archive / Delete actions now live inside
                      TrackerDetails (opens on card tap). Bulk
                      Archive / Delete are still available via the
                      "Изменить" button above (selection mode). */}
                  {regularTrackers.map((tracker) => (
                    <div key={tracker.id}>
                      {renderTrackerCard(tracker, false)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {playTrackers.length > 0 && (
              <div id="play-round-section" className="space-y-3 animate-fade-in scroll-mt-20">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      🎲 {t("today.playRoundSection")}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {t("today.playRoundHint")}
                    </p>
                  </div>
                  {/* Two bulk actions side-by-side — symmetric so the
                      "Keep all" path feels just as available as the
                      "Clear all" path. Pill buttons match the visual
                      weight of the row above. */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => keepAllPlayCards()}
                      className="flex-1 text-xs rounded-full h-8 bg-balanced/10 text-balanced hover:bg-balanced/20 hover:text-balanced"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t("today.keepAllPlay")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAllPlayCards()}
                      className="flex-1 text-xs rounded-full h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {t("today.deleteAllPlay")}
                    </Button>
                  </div>
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
        isArchived={duplicateIsArchived}
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={handleCreateAnyway}
        onRestoreFromArchive={async () => {
          if (duplicateTracker) {
            await restoreFromArchive(duplicateTracker.id);
          }
          setDuplicateDialogOpen(false);
          setPendingTracker(null);
          setDuplicateTracker(null);
          setDuplicateIsArchived(false);
        }}
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

      {/* Floating Action Button — pinned bottom-right, always
          visible. The top "+ Новый вопрос" in the header is good
          for first-impression discovery, but as the tracker list
          grows the user has to scroll all the way back to access
          it. The FAB removes that friction. Tucked above the
          bottom tab bar via safe-area-aware bottom offset.
          aria-hidden on the duplicate label since the header
          button already announces this action to screen readers. */}
      <button
        type="button"
        onClick={() => setAddTrackerModalOpen(true)}
        aria-label={t("common.addPattern")}
        className="fixed right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
        }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.25} />
      </button>
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

