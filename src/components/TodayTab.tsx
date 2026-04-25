import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries, saveTrackers } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings as SettingsIcon, Play, X, Lightbulb, Flame } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

  useEffect(() => {
    const sync = () => setIdeasDismissed(localStorage.getItem("memap_ideas_dismissed") === "true");
    window.addEventListener("memap-settings-changed", sync);
    return () => window.removeEventListener("memap-settings-changed", sync);
  }, []);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTracker, setDuplicateTracker] = useState<Tracker | null>(null);
  const [pendingTracker, setPendingTracker] = useState<Tracker | null>(null);
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

  // Selected date for viewing/editing entries (default: today)
  const [selectedDate, setSelectedDate] = useState(() => 
    new Date().toISOString().split("T")[0]
  );

  const today = new Date().toISOString().split("T")[0];
  const isViewingToday = selectedDate === today;

  useEffect(() => {
    loadData();
  }, []);

  // Re-pull entries whenever another view (TrackerDetails, calendar, session)
  // persists a change. Keeps Today's Yes/No pills in sync after edits.
  useEffect(() => {
    const sync = () => { loadData(); };
    const openSession = () => setDailySessionOpen(true);
    window.addEventListener("memap-entries-changed", sync);
    window.addEventListener("memap-trackers-changed", sync);
    // Index dispatches this on cold launch when there are unanswered
    // questions for today, and TodayTab dispatches it from the session card.
    // Both paths land here so DailySession ownership stays in TodayTab.
    window.addEventListener("memap-open-session", openSession);
    return () => {
      window.removeEventListener("memap-entries-changed", sync);
      window.removeEventListener("memap-trackers-changed", sync);
      window.removeEventListener("memap-open-session", openSession);
    };
  }, []);

  const loadData = async () => {
    const [trackersData, entriesData] = await Promise.all([
      getTrackers(),
      getEntries(),
    ]);
    const sortedTrackers = [...trackersData].sort((a, b) => {
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

  const handleArchiveTracker = async () => {
    if (!selectedTrackerForDetails) return;
    const updatedTrackers = trackers.map(t =>
      t.id === selectedTrackerForDetails.id ? { ...t, archived: true } : t
    );
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers.filter(t => !t.archived));
    setSheetOpen(false);
    setSelectedTrackerForDetails(null);
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
            // Restart the session in play mode without unmounting it —
            // toggling state remounts via key change below.
            setPlayMode(true);
          }}
          playMode={playMode}
          // Re-mount the session when playMode flips so the deck rebuilds
          // fresh against the new mode.
          key={playMode ? "play" : "normal"}
        />
      )}

      {/* Header row: title, streak chip, "+ Add", "Notes" link.
          Cards screen replaces what used to be Today tab. The big "session
          card" and "Yes/No buttons per tracker" are gone — those live
          exclusively in the session reachable via the bottom-nav ▶. */}
      <div className="animate-fade-in space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-serif font-medium tracking-tight">
            {t("common.cards")}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} }))}
              className="text-xs px-3 py-1.5 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("common.notesLink")}
            </button>
            <Button
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

        {globalStreak.currentStreak > 0 && (
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20">
              <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={2} fill="currentColor" />
              <span className="text-xs font-medium text-foreground">
                <span className="font-serif text-sm font-semibold tabular-nums">{globalStreak.currentStreak}</span>
                <span className="text-muted-foreground ml-1">{globalStreak.currentStreak === 1 ? t("today.streakDaysOne") : t("today.streakDaysMany", { count: globalStreak.currentStreak })}</span>
              </span>
            </div>
          </div>
        )}
      </div>

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
        const regularTrackers = trackers.filter((tr) => tr.source !== "play");
        const playTrackers = trackers.filter((tr) => tr.source === "play");

        const renderTrackerCard = (tracker: Tracker, isPlay: boolean) => {
          const TIcon = getTrackerIcon(tracker.title, tracker.category);
          const todayEntry = getSelectedDateEntry(tracker.id);
          const answered = todayEntry !== undefined;
          return (
            <Card
              key={tracker.id}
              onClick={() => handleOpenTrackerDetails(tracker)}
              className="card-premium cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
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
                {isPlay ? (
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
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-2">
                  {regularTrackers.map((tracker) => renderTrackerCard(tracker, false))}
                </div>
              </div>
            )}

            {playTrackers.length > 0 && (
              <div className="space-y-3 animate-fade-in">
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

      {/* Bottom Sheet for Tracker Details */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedTrackerForDetails && (() => {
                const TIcon = getTrackerIcon(selectedTrackerForDetails.title, selectedTrackerForDetails.category);
                return <TIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />;
              })()}
              <span>{selectedTrackerForDetails ? localizeTrackerTitle(selectedTrackerForDetails.title) : ""}</span>
            </SheetTitle>
          </SheetHeader>
          
          {selectedTrackerForDetails && (
            <div className="mt-4">
              <TrackerDetails
                tracker={selectedTrackerForDetails}
                trackers={trackers}
                currentIndex={selectedTrackerIndex}
                onNavigateTracker={handleNavigateTracker}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
              
              {/* Edit section at bottom */}
              <div className="mt-6 pt-4 border-t space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">{t("today.trackerSettings")}</p>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setSettingsModalOpen(true)}
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  {t("today.editTrackerSettings")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleArchiveTracker}
                >
                  {t("today.archiveTracker")}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => {
                    setTrackerToDelete(selectedTrackerForDetails);
                    setDeleteDialogOpen(true);
                  }}
                >
                  {t("today.deleteTracker")}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
