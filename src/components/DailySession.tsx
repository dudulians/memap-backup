import { useState, useRef, useEffect, useCallback } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { X, ChevronRight, ChevronLeft, Sparkles, Shuffle, Pencil, CalendarDays, BarChart3, Home, Undo2 } from "lucide-react";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { TEMPLATE_GROUPS } from "@/lib/templateGroups";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { playSwipeSound } from "@/lib/feedback";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerQuestion } from "@/lib/trackerLocalize";
import { ru as ruLocale } from "date-fns/locale";
import { format } from "date-fns";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { Flame } from "lucide-react";

interface DailySessionProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  selectedDate: string;
  onAnswer: (trackerId: string, value: boolean) => Promise<void>;
  /**
   * Called by the in-session Undo button when the user wants the
   * previous answer truly gone (not just overwritten). The parent
   * removes the entry from storage. Optional — if not wired the
   * Undo button still navigates back, just without clearing the
   * saved answer.
   */
  onClearAnswer?: (trackerId: string, date: string) => Promise<void>;
  onClose: () => void;
  // Called when the user picks "today's overview" on the completion screen
  // (or when the deck is empty and the user closes). Lands them on Today.
  onComplete: () => void;
  // Optional second exit on the completion screen — "see my patterns".
  // If omitted, only the "today's overview" button is shown (back-compat).
  onGoToPatterns?: () => void;
  // When provided, the session shows a 7-day date strip in its header so
  // the user can switch which day they're answering for without leaving.
  // The parent owns `selectedDate` and updates it on this callback.
  onDateChange?: (date: string) => void;
  // Triggered from the Done screen — starts a 10-card "play round" of
  // random new templates. The parent decides what that flow looks like.
  onPlayRandom?: () => void;
  // When true, the session runs in "random play" mode: the deck is 10
  // random NEW templates (not the user's regular trackers), and any card
  // answered is saved as a tracker tagged with `source: "play"` so it
  // shows in a separate Cards section the user can prune later.
  playMode?: boolean;
}

interface SessionQuestion {
  tracker: Tracker;
  existingAnswer?: boolean;
  isNew?: boolean;
  templateId?: string;
}

// Session settings from localStorage
const getSessionSettings = () => {
  const data = localStorage.getItem("memap_session_settings");
  const fallback = {
    includeSuggestedQuestions: true,
    soundEnabled: true,
    hapticsEnabled: true,
    lastRecommendationDate: null as string | null,
  };
  if (!data) return fallback;
  try {
    const parsed = JSON.parse(data);
    // Migration: pre-split users have soundEnabled but no
    // hapticsEnabled — fall back to the previous combined value so
    // we don't surprise them by re-enabling vibration silently.
    const merged = { ...fallback, ...parsed };
    if (typeof parsed?.hapticsEnabled !== "boolean") {
      merged.hapticsEnabled = parsed?.soundEnabled !== false;
    }
    return merged;
  } catch {
    return fallback;
  }
};

const patchSessionSettings = (updates: Record<string, unknown>) => {
  const current = getSessionSettings();
  localStorage.setItem("memap_session_settings", JSON.stringify({ ...current, ...updates }));
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Sound feedback — delegates to the shared feedback module, which uses a
// single long-lived AudioContext and a smooth envelope so the tones don't
// sound harsh. Respects the sound/vibration toggle in Settings.
const playFeedbackSound = (type: "yes" | "no" | "skip") => {
  const settings = getSessionSettings();
  if (!settings.soundEnabled) return;
  playSwipeSound(type);
};

// Haptic feedback — uses native @capacitor/haptics on iOS/Android. Goes
// through lib/haptics.ts (the same module the Settings "Test vibration"
// diagnostic uses) for consistency: if the test button feels haptics on
// device, this path will too. Gated on hapticsEnabled (its own toggle
// in Settings, separate from soundEnabled). The user's report — "test
// works but no vibration when swiping" — was the trigger to unify these
// paths so we never have two ways of asking iOS for a haptic.
const triggerHaptic = (type: "light" | "medium" | "heavy") => {
  const settings = getSessionSettings();
  if (!settings.hapticsEnabled) return;
  // medium → heavy on commit so a Yes/No swipe lands with a noticeable
  // thump (the previous "medium" felt too subtle competing with the
  // visual fly-out animation + the audio cue).
  if (type === "heavy" || type === "medium") {
    haptics.medium();
  } else {
    haptics.swipe();
  }
};

export const DailySession = ({
  trackers,
  entries,
  selectedDate,
  onAnswer,
  onClearAnswer,
  onClose,
  onComplete,
  onGoToPatterns,
  onDateChange,
  onPlayRandom,
  playMode = false,
}: DailySessionProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const settings = getSessionSettings();
  
  // Build the deck of unanswered questions + new suggestions.
  // In `playMode`, the deck is 10 random new templates regardless of the
  // user's existing trackers — pure exploration / play.
  const buildDeck = useCallback((): SessionQuestion[] => {
    const existingTrackerIds = new Set(trackers.map(t => t.id));

    if (playMode) {
      // Pull from BOTH catalogs so the random pool is ~95 templates
      // wide instead of just the 18 in TEMPLATE_GROUPS. Without this,
      // a second play round could only offer 8 unique cards (18 - 10
      // already-played) and felt like reruns.
      const fromGroups = TEMPLATE_GROUPS.flatMap((g) => g.templates).map((tpl) => ({
        id: `tg-${tpl.id}`,
        title: tpl.title,
        questionText: tpl.questionText,
        category: tpl.category,
        subcategory: tpl.subcategory,
        periodDays: tpl.periodDays,
        threshold: tpl.threshold,
        problemWhen: tpl.problemWhen,
        adviceAboveThreshold: tpl.adviceAboveThreshold,
      }));
      const fromStreams = LIFE_STREAMS.flatMap((s) => s.templates).map((tpl) => ({
        id: `ls-${tpl.id}`,
        title: tpl.title,
        questionText: tpl.questionText,
        category: tpl.category,
        subcategory: tpl.subcategory,
        periodDays: tpl.periodDays,
        threshold: tpl.threshold,
        problemWhen: tpl.problemWhen,
        adviceAboveThreshold: tpl.adviceAboveThreshold,
      }));
      const all = [...fromGroups, ...fromStreams];
      // Existing-title set comparing both stored EN and what would be
      // displayed RU — covers the case where one side of the catalog
      // pair is stored and the other side appears in the candidate.
      const norm = (s: string) => s.toLowerCase().trim();
      const existingTitles = new Set<string>();
      trackers.forEach((tr) => existingTitles.add(norm(tr.title)));
      // Dedup the catalog pool itself (an id-collision in the source
      // catalogs would otherwise let the same title slip through twice).
      const seenInPool = new Set<string>();
      const available = all.filter((tpl) => {
        const key = norm(tpl.title);
        if (existingTitles.has(key)) return false;
        if (seenInPool.has(key)) return false;
        seenInPool.add(key);
        return true;
      });
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, 10);
      return picked.map((tpl) => ({
        tracker: {
          id: `play-${tpl.id}`,
          title: tpl.title,
          questionText: tpl.questionText,
          category: tpl.category,
          subcategory: tpl.subcategory,
          periodDays: tpl.periodDays,
          threshold: tpl.threshold,
          problemWhen: tpl.problemWhen,
          adviceAboveThreshold: tpl.adviceAboveThreshold,
          answerType: "boolean" as const,
          createdAt: new Date().toISOString(),
        },
        isNew: true,
        templateId: tpl.id,
      }));
    }
    
    // Step 1: Get unanswered questions from active trackers
    const unansweredQuestions = trackers
      .filter(tracker => !tracker.archived)
      .map(tracker => {
        const existingEntry = entries.find(
          e => e.trackerId === tracker.id && e.date === selectedDate
        );
        return {
          tracker,
          existingAnswer: existingEntry?.value,
          isNew: false,
        };
      })
      .filter(q => q.existingAnswer === undefined);

    // Auto-injected "new suggestion" cards have been removed. The user
    // gets new ideas only via:
    //   a) the "Idea of the day" carousel on the Cards screen (with an
    //      explicit "+ Add to my map" button), and
    //   b) the Shuffle button (🎲) which opens an explicit play round.
    // Daily session now contains only the user's own trackers — no
    // surprise cards appear without the user asking for them.
    return unansweredQuestions;
  }, [trackers, entries, selectedDate]);

  // Deck rebuilds when selectedDate changes — that lets the date-strip in
  // the header navigate to other days without unmounting the session.
  const [deck, setDeck] = useState<SessionQuestion[]>(() => buildDeck());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [newPatternsAdded, setNewPatternsAdded] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "down" | null>(null);
  const [completed, setCompleted] = useState(false);
  // Fire one success haptic when the round transitions to "done", no
  // matter which path triggered it (last answer, last skip, disable-recs).
  useEffect(() => {
    if (completed) haptics.success();
  }, [completed]);
  // The custom sheet-drag state used to live here — it's gone now
  // because the whole session is wrapped in our vaul-based
  // BottomSheet which handles drag-to-dismiss itself, including the
  // tricky scroll-vs-drag coordination on iOS.

  // Build the deck on mount and on date change ONLY. Crucially we do
  // NOT depend on entries / trackers / buildDeck here — if we did,
  // every answered card would trigger a re-render of the parent
  // (entries change), which would re-fire this effect, which would
  // call buildDeck() (excluding the just-answered card), which would
  // setDeck(shorter list) + setCurrentIndex(0). That raced against
  // handleAnswer's setTimeout(setCurrentIndex+1), producing the
  // counter bouncing 1/5 → 2/4 → 2/3 → 2/2 → 1/1 the user reported.
  // The deck is frozen for the lifetime of one (date, mount) pair;
  // it gets rebuilt only when the user navigates to another day via
  // the date strip / past-dates picker. Each new playMode round gets
  // a fresh deck via the parent's `key` change, not this effect.
  useEffect(() => {
    if (playMode) return;
    const newDeck = buildDeck();
    setDeck(newDeck);
    setCurrentIndex(0);
    // If the user navigates (via the date strip OR the past-dates
    // calendar) to a date that's already fully answered, the deck is
    // empty AND there's no `currentQuestion` to render — we'd
    // otherwise hit `if (!currentQuestion) return null` and the whole
    // sheet would silently disappear, stranding the user with no
    // visible Play and an `open` state stuck at true. Instead, jump
    // straight to the Done screen for that day so the user keeps
    // their context, sees "all answered for [date]", and can pick
    // another date or close.
    const hasEntriesForDate = entries.some((e) => {
      if (e.date !== selectedDate) return false;
      return trackers.some((t) => t.id === e.trackerId && !t.archived);
    });
    setCompleted(newDeck.length === 0 && hasEntriesForDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, playMode]);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const activePointerId = useRef<number | null>(null);
  const currentDx = useRef(0);
  const currentDy = useRef(0);
  const isAnimatingRef = useRef(false);

  // Stack of "which tracker did we just answer (or skip), and was the
  // entry actually saved" — drives the Undo button. Only Yes/No swipes
  // push a saved=true entry; Skip pushes saved=false because skip
  // doesn't write anything. On Undo we pop the head, and if it was
  // saved we ask the parent to delete the entry — that way "go back"
  // really erases the action instead of just navigating to the card
  // (which would leave the saved Yes/No silently in storage).
  const answeredHistory = useRef<Array<{ trackerId: string; saved: boolean }>>([]);

  // Record the date the moment a suggestion card is first shown
  useEffect(() => {
    if (deck[currentIndex]?.isNew) {
      patchSessionSettings({ lastRecommendationDate: todayLocal() });
    }
  }, [currentIndex]);

  const handleDisableRecommendations = () => {
    patchSessionSettings({ includeSuggestedQuestions: false });
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const currentQuestion = deck[currentIndex];
  const totalQuestions = deck.length;
  const progress = totalQuestions > 0 ? ((currentIndex) / totalQuestions) * 100 : 100;

  // Lock body scroll when session is active
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, []);

  useEffect(() => {
    if (totalQuestions === 0) {
      setCompleted(true);
    }
  }, [totalQuestions]);

  const handleAnswer = (value: boolean) => {
    if (isAnimatingRef.current || !currentQuestion) return;

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection(value ? "right" : "left");

    // Record for Undo. saved=true because handleAnswer always writes
    // (even on isNew suggestion cards — those create a new tracker
    // first via getTrackers/saveTrackers, then save the answer).
    answeredHistory.current.push({
      trackerId: currentQuestion.tracker.id,
      saved: true,
    });

    // Play sound and haptic
    playFeedbackSound(value ? "yes" : "no");
    triggerHaptic("medium");
    setAnsweredCount(prev => prev + 1);

    // Kick off persistence in the background — never await it here,
    // so a failure or slow write can't lock the session.
    (async () => {
      try {
        if (currentQuestion.isNew) {
          // Suggested question: create the tracker and save the answer
          // regardless of Yes/No. Previously we only saved on Yes, so a
          // No answer was silently thrown away and the user wondered
          // why they even answered it.
          // In playMode, mark with source="play" so the Cards screen
          // groups these into a "Play round" section the user can prune.
          const newTracker: Tracker = {
            ...currentQuestion.tracker,
            id: uuid(),
            createdAt: new Date().toISOString(),
            ...(playMode ? { source: "play" as const } : {}),
          };
          const existingTrackers = await getTrackers();
          await saveTrackers([...existingTrackers, newTracker]);
          await onAnswer(newTracker.id, value);
          setNewPatternsAdded(prev => prev + 1);
        } else {
          await onAnswer(currentQuestion.tracker.id, value);
        }
      } catch (err) {
        console.error("DailySession: save failed", err);
      }
    })();

    // Advance the UI on a fixed animation timer — independent of the save.
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
        triggerConfetti();
      }
      setSwipeDirection(null);
      setIsAnimating(false);
      isAnimatingRef.current = false;
      setDragX(0);
      setDragY(0);
      currentDx.current = 0;
      currentDy.current = 0;
    }, 300);
  };

  const handleSkip = () => {
    if (isAnimatingRef.current || !currentQuestion) return;

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection("down");

    // Record for Undo. saved=false because skip doesn't write any
    // entry — Undo just navigates back, no clearAnswer call needed.
    answeredHistory.current.push({
      trackerId: currentQuestion.tracker.id,
      saved: false,
    });

    // Play sound and haptic
    playFeedbackSound("skip");
    triggerHaptic("light");
    
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
        if (answeredCount > 0) {
          triggerConfetti();
        }
      }
      setSwipeDirection(null);
      setIsAnimating(false);
      isAnimatingRef.current = false;
      setDragX(0);
      setDragY(0);
      currentDx.current = 0;
      currentDy.current = 0;
    }, 200);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#DDA0DD'],
    });
  };

  // Pointer-down timestamp for velocity-based "flick" detection — short,
  // fast swipes register as Yes/No even if their travel distance is small.
  const touchStartTime = useRef<number>(0);

  // Unified pointer handlers (mouse + touch + pen)
  // Direction-lock note: we used to YIELD on vertical-dominant motion
  // so vaul could pick it up for drag-to-close. But the card area is
  // now opted out of vaul (data-vaul-no-drag) — yielding would leave
  // vertical motion unhandled. So now we always claim once motion
  // crosses the threshold, and dispatch in endPointer based on the
  // final dx/dy:
  //   • horizontal-dominant       → Yes (right) / No (left)
  //   • vertical-down-dominant    → Skip
  //   • everything else           → snap back
  // This also unlocked diagonal-up swipes for Yes/No, which the user
  // pointed out used to fail (any motion with vertical component
  // bigger than horizontal got yielded away).
  const hasClaimedSwipe = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnimatingRef.current) return;
    const target = e.target as HTMLElement;
    // Let buttons & interactive controls handle their own clicks
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;
    if (activePointerId.current !== null) return;

    activePointerId.current = e.pointerId;
    // Deliberately NOT calling setPointerCapture here. We capture
    // only in pointermove once we've confirmed horizontal-dominant
    // motion — see comment on hasClaimedSwipe above.
    hasClaimedSwipe.current = false;
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    touchStartTime.current = Date.now();
    currentDx.current = 0;
    currentDy.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    const dx = e.clientX - touchStartX.current;
    const dy = e.clientY - touchStartY.current;

    // Claim once motion is meaningful. Both horizontal and vertical
    // belong to us on this card area (vaul is opted out via
    // data-vaul-no-drag); endPointer routes the gesture by direction.
    if (!hasClaimedSwipe.current) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      // Not enough motion yet to decide.
      if (absDx < 10 && absDy < 10) return;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      hasClaimedSwipe.current = true;
    }

    currentDx.current = dx;
    currentDy.current = dy;
    setDragX(dx);
    setDragY(dy);
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    activePointerId.current = null;

    const dx = currentDx.current;
    const dy = currentDy.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocityX = absX / elapsed; // px per ms

    // Skip-down FIRST — when the gesture is clearly mostly-vertical
    // and downward, route to skip regardless of horizontal jiggle.
    // Sheet-dismiss via drag-down still works from the header above
    // the card (vaul catches it there) and via the X button.
    if (dy > 150 && absY > absX * 1.5) {
      handleSkip();
      return;
    }

    // Yes/No — two ways to fire:
    //   1) Distance — at least 50 px horizontal, no ratio gate vs
    //      vertical so diagonal flicks (up-right, down-left, …) all
    //      count as long as horizontal is committed enough.
    //   2) Velocity — a fast flick (>= 0.5 px/ms) with >= 25 px of
    //      horizontal travel. Lets a wrist-flick fire even if the
    //      total distance is short.
    // Removing the absX/absY ratio fixed the user's "I can swipe
    // sideways or sideways-down but not sideways-up" — natural
    // finger arcs for a right-flick often go up-right at a steep
    // angle (especially with thumb), which the old ratio gate
    // (absX >= absY * 0.7) rejected.
    const distanceTrigger = absX >= 50;
    const velocityTrigger = velocityX >= 0.5 && absX >= 25;

    if (distanceTrigger || velocityTrigger) {
      if (dx > 0) handleAnswer(true); else handleAnswer(false);
      return;
    }
    setDragX(0);
    setDragY(0);
    currentDx.current = 0;
    currentDy.current = 0;
  };

  if (completed) {
    // Compute streak fresh on the completion screen — the user just
    // finished a session, give them the up-to-date number as reward.
    const streak = calculateGlobalStreak(entries);

    // Action rows for the Done screen. Each row = icon, title, subtitle,
    // chevron. Clean tappable list — much more attention-grabbing than
    // a stack of mismatched-style buttons. The "play random" row invites
    // the user to keep going if they want.

    // Map of recent dates → fill status, used by the Past Dates
    // calendar below so the user sees at a glance which days are
    // already done. Computing here (inside the Done branch render)
    // is fine — the rows are built each time too, and the loop is
    // bounded to 90 days so it's microseconds.
    const fillStatusByDate = new Map<string, "full" | "partial" | "empty">();
    const activeTrackers = trackers.filter((tr) => !tr.archived);
    if (activeTrackers.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let offset = 1; offset <= 90; offset++) {
        const d = new Date(today);
        d.setDate(today.getDate() - offset);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const answeredCount = activeTrackers.filter((tr) =>
          entries.some((e) => e.trackerId === tr.id && e.date === iso),
        ).length;
        if (answeredCount === activeTrackers.length) {
          fillStatusByDate.set(iso, "full");
        } else if (answeredCount > 0) {
          fillStatusByDate.set(iso, "partial");
        } else {
          fillStatusByDate.set(iso, "empty");
        }
      }
    }
    const dateToIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    type ActionRow = {
      key: string;
      icon: typeof BarChart3;
      title: string;
      subtitle: string;
      onClick: () => void;
      tone?: "primary" | "default";
    };
    const rows: ActionRow[] = [];
    // After a play round, the obvious next step is "go check the cards
    // you just collected and decide what to keep" — make that the
    // primary action. Goes to Cards and dispatches an event the section
    // can use to scroll itself into view.
    if (playMode) {
      rows.push({
        key: "review-play",
        icon: Shuffle,
        title: t("dailySession.rowReviewPlayTitle"),
        subtitle: t("dailySession.rowReviewPlaySubtitle"),
        onClick: () => {
          onComplete();
          setTimeout(() => {
            window.dispatchEvent(new Event("memap-scroll-to-play"));
          }, 0);
        },
        tone: "primary",
      });
      // Keep the option to play another round straight away.
      if (onPlayRandom) {
        rows.push({
          key: "another-round",
          icon: Shuffle,
          title: t("dailySession.rowAnotherRoundTitle"),
          subtitle: t("dailySession.rowAnotherRoundSubtitle"),
          onClick: onPlayRandom,
        });
      }
      rows.push({
        key: "note",
        icon: Pencil,
        title: t("dailySession.rowNoteTitle"),
        subtitle: t("dailySession.rowNoteSubtitle"),
        onClick: () => {
          onComplete();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("memap-open-notes", {
              detail: { from: "play" },
            }));
          }, 0);
        },
      });
      rows.push({
        key: "overview",
        icon: Home,
        title: t("dailySession.rowOverviewTitle"),
        subtitle: t("dailySession.rowOverviewSubtitle"),
        onClick: onComplete,
      });
    } else {
      if (onGoToPatterns) {
        rows.push({
          key: "patterns",
          icon: BarChart3,
          title: t("dailySession.rowPatternsTitle"),
          subtitle: t("dailySession.rowPatternsSubtitle"),
          onClick: onGoToPatterns,
          tone: "primary",
        });
      }
      if (onDateChange) {
        rows.push({
          key: "past-dates",
          icon: CalendarDays,
          title: t("dailySession.rowPastDatesTitle"),
          subtitle: t("dailySession.rowPastDatesSubtitle"),
          // No onClick — the row is wrapped in a Popover below so the
          // user can pick any past date, not just yesterday.
          onClick: () => { /* opened via Popover */ },
        });
      }
      // "Сыграть случайный раунд" — restored after the user clarified
      // she does want this on the regular Done screen. The earlier
      // removal was based on a different request (don't auto-inject
      // surprise cards INTO the user's normal session deck), which is
      // still respected: the regular session deck is built only from
      // the user's own active trackers — see buildDeck above. This row
      // is just an explicit, opt-in entry to the random round, not an
      // automatic injection.
      if (onPlayRandom) {
        rows.push({
          key: "random-round",
          icon: Shuffle,
          title: t("dailySession.rowRandomRoundTitle"),
          subtitle: t("dailySession.rowRandomRoundSubtitle"),
          onClick: onPlayRandom,
        });
      }
      rows.push({
        key: "note",
        icon: Pencil,
        title: t("dailySession.rowNoteTitle"),
        subtitle: t("dailySession.rowNoteSubtitle"),
        onClick: () => {
          // Tag the source so Notes back returns to the play session
          // instead of dropping the user on Cards.
          const fromPlay = playMode;
          onComplete();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("memap-open-notes", {
              detail: { from: fromPlay ? "play" : "session" },
            }));
          }, 0);
        },
      });
      rows.push({
        key: "overview",
        icon: Home,
        title: onGoToPatterns
          ? t("dailySession.rowOverviewTitle")
          : t("dailySession.backToToday"),
        subtitle: t("dailySession.rowOverviewSubtitle"),
        onClick: onComplete,
      });
    }

    return (
      // Done state — wrapped in BottomSheet with Apple-Music-style
      // presentation (scaleBackground + 95vh) so the sheet sits as a
      // visible "card on top of the app" rather than a generic panel.
      // The sliver of background still showing at the top + the
      // shrunk-down app underneath give the user a clear "I'm in the
      // app, on this screen" cue.
      <BottomSheet
        open
        onOpenChange={(o) => { if (!o) onClose(); }}
        className="h-[95vh] flex flex-col p-0"
        scaleBackground
        ariaTitle="Session complete"
      >
        <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 pt-6 pb-6 gap-6 animate-fade-in">
          {/* Hero moment — confetti emoji + the streak number as the
              centerpiece. Big serif numeral grabs attention. */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="text-5xl">🎉</div>
            {streak.currentStreak > 0 && (
              <div className="flex flex-col items-center">
                <div className="font-serif text-7xl font-medium tabular-nums leading-none text-foreground">
                  {streak.currentStreak}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Flame className="h-4 w-4 text-orange-500" strokeWidth={2} fill="currentColor" />
                  <span className="text-sm text-muted-foreground">
                    {streak.currentStreak === 1
                      ? t("today.streakDaysOne")
                      : t("today.streakDaysMany", { count: streak.currentStreak })}
                  </span>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground max-w-xs pt-1">
              {playMode
                ? (answeredCount === 1
                    ? t("dailySession.playRoundOne")
                    : t("dailySession.playRoundMany", { count: answeredCount }))
                : deck.length === 0
                // Tell the user *which* day is filled. Without the date,
                // the message reads "all caught up for today" no matter
                // which past day they navigated to — confusing if they
                // got here by tapping April 25 in the calendar.
                ? selectedDate !== todayLocal()
                  ? t("dailySession.caughtUpForDate", {
                      date: format(new Date(selectedDate + "T00:00:00"), "d MMMM", { locale: dateLocale }),
                    })
                  : t("dailySession.caughtUp")
                : answeredCount > 0
                ? (answeredCount === 1
                    ? t("dailySession.answeredOne")
                    : t("dailySession.answeredMany", { count: answeredCount }))
                : t("dailySession.seeYouTomorrow")}
            </p>
            {newPatternsAdded > 0 && (
              <p className="text-xs text-primary">
                {newPatternsAdded === 1
                  ? t("dailySession.newPatternsOne")
                  : t("dailySession.newPatternsMany", { count: newPatternsAdded })}
              </p>
            )}
          </div>

          {/* Action list — vertical, each row touchable. Primary action
              gets a tinted background; rest are clean rows. */}
          <div className="w-full max-w-sm space-y-2">
            {rows.map((row) => {
              const Icon = row.icon;
              const primary = row.tone === "primary";
              const buttonClasses = cn(
                "w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all active:scale-[0.99]",
                primary
                  ? "bg-primary/10 border border-primary/30 hover:bg-primary/15"
                  : "bg-muted/30 border border-transparent hover:bg-muted/50",
              );

              // Special case: "past-dates" row opens a calendar
              // popover instead of firing a static onClick — the
              // user picks any past day, not just yesterday.
              if (row.key === "past-dates" && onDateChange) {
                return (
                  <Popover key={row.key}>
                    <PopoverTrigger asChild>
                      <button className={buttonClasses}>
                        <div
                          className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                            primary
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-foreground",
                          )}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", primary && "text-primary")}>{row.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{row.subtitle}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <CalendarPicker
                        mode="single"
                        locale={dateLocale}
                        onSelect={(d) => {
                          if (d) {
                            haptics.tap();
                            const iso = dateToIso(d);
                            onDateChange(iso);
                          }
                        }}
                        // Block today and future — this row is for
                        // back-filling, today is what the regular
                        // session is already for.
                        disabled={(d) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return d >= today;
                        }}
                        // Visual fill status — green dot under fully
                        // answered days, amber under partial, none for
                        // empty days. Saves the user from tap-to-find.
                        modifiers={{
                          fullyFilled: (d) => fillStatusByDate.get(dateToIso(d)) === "full",
                          partiallyFilled: (d) => fillStatusByDate.get(dateToIso(d)) === "partial",
                        }}
                        modifiersClassNames={{
                          fullyFilled:
                            "relative after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-0.5 after:w-1.5 after:h-1.5 after:rounded-full after:bg-emerald-500",
                          partiallyFilled:
                            "relative after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-0.5 after:w-1.5 after:h-1.5 after:rounded-full after:bg-amber-400",
                        }}
                      />
                      {/* Tiny legend so the dots are self-explanatory. */}
                      <div className="flex items-center gap-3 px-3 pt-1 pb-2 text-[10px] text-muted-foreground border-t">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t("dailySession.legendFilled")}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {t("dailySession.legendPartial")}
                        </span>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <button
                  key={row.key}
                  onClick={row.onClick}
                  className={buttonClasses}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      primary
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", primary && "text-primary")}>
                      {row.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {row.subtitle}
                    </p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 flex-shrink-0", primary ? "text-primary" : "text-muted-foreground/40")} />
                </button>
              );
            })}
          </div>

          {/* Explicit "close" at the bottom — mirrors the active-session
              footer so the user always has a thumb-reachable way out
              instead of the screen feeling like it floats outside the app. */}
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors mt-1"
          >
            {t("common.close")}
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const categoryColor = getCategoryColor(currentQuestion.tracker.category);
  // When "yes" is the problem signal → Yes = red/strong, No = green/balanced. Flip otherwise.
  const yesIsSignificant = currentQuestion.tracker.problemWhen === "yes";
  const yesColorClass = yesIsSignificant ? "strong" : "balanced";
  const noColorClass = yesIsSignificant ? "balanced" : "strong";

  return (
    // Deck mode wrapped in BottomSheet with Apple-Music-style
    // presentation. scaleBackground + 95vh height = "card layered on
    // top of the app" feel, matches Apple Music / Yandex Music
    // Now Playing. Drag-down from the header (above the card area)
    // closes; the card area itself opts out of vaul's drag via
    // data-vaul-no-drag below so horizontal yes/no swipes don't
    // compete with vertical drag-to-close.
    <BottomSheet
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      className="h-[95vh] flex flex-col p-0"
      scaleBackground
      ariaTitle={t("dailySession.questionOf", { current: currentIndex + 1, total: totalQuestions })}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pb-2 pt-2 border-b flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          {/* Smart undo. Pops the answered-history stack and:
              - if the previous action was a saved Yes/No → asks the
                parent to remove that entry (so the day reads as
                un-answered, e.g. notifications fire later, calendar
                dot disappears, threshold count decrements).
              - if it was a Skip → just navigates back, nothing to
                clear.
              Hidden during the post-swipe animation to avoid mid-
              flight state mixups. */}
          {/* Fixed h-9 so the row's height stays the same whether
              the Undo button is rendered or not — otherwise the slot
              collapses to 0 height when hidden, the title row jumps
              up/down between renders, and the date strip below
              visibly trembles every time the user starts a swipe
              (which sets isAnimating, hiding the button). */}
          <div className="w-9 h-9 flex items-center justify-start">
            {currentIndex > 0 && !isAnimating && (
              <button
                type="button"
                onClick={() => {
                  const last = answeredHistory.current.pop();
                  if (last?.saved && onClearAnswer) {
                    // Fire-and-forget like handleAnswer — never block
                    // the UI on a save/delete round-trip.
                    onClearAnswer(last.trackerId, selectedDate).catch((err) => {
                      console.warn("[DailySession] onClearAnswer failed", err);
                    });
                    setAnsweredCount((c) => Math.max(0, c - 1));
                  }
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                  setSwipeDirection(null);
                  setIsAnimating(false);
                  isAnimatingRef.current = false;
                  setDragX(0);
                  setDragY(0);
                  currentDx.current = 0;
                  currentDy.current = 0;
                }}
                aria-label={t("dailySession.previousQuestion")}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <Undo2 className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {t("dailySession.questionOf", { current: currentIndex + 1, total: totalQuestions })}
            </p>
            {selectedDate !== todayLocal() && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("dailySession.fillingInFor", { date: format(new Date(selectedDate + "T00:00:00"), "MMM d", { locale: dateLocale }) })}
              </p>
            )}
          </div>
          <div className="w-9 h-9" />
        </div>

        {/* Date strip — last 7 days. Tap any to answer for that date.
            Future dates are excluded — you can't pre-fill tomorrow. */}
        {onDateChange && (() => {
          const todayStr = todayLocal();
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return { iso, dayNum: d.getDate(), date: d };
          });
          return (
            <div className="flex items-center justify-between gap-1">
              {days.map(({ iso, dayNum, date }) => {
                const isSelected = iso === selectedDate;
                const isToday = iso === todayStr;
                const weekday = format(date, "EEEEEE", { locale: dateLocale });
                return (
                  <button
                    key={iso}
                    onClick={() => { haptics.tap(); onDateChange(iso); }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center py-1 rounded-full transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span className="text-[9px] uppercase tracking-wider opacity-70">{weekday}</span>
                    <span className={cn(
                      "text-sm font-medium tabular-nums",
                      isToday && !isSelected && "text-foreground"
                    )}>{dayNum}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 flex-shrink-0">
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Card area — pointer handlers attached HERE only, not on the
          whole deck wrapper. With handlers on the wrapper, every
          touch (header, buttons, anywhere) had to go through our
          direction-lock first; on iOS WebView that handshake cost
          enough latency to make vaul's drag-to-close feel sluggish
          compared to Settings/TrackerDetails.

          data-vaul-no-drag: opts this region out of vaul's
          drag-to-close. Apple Music does the same — drag-down to
          dismiss only fires from the top of the sheet (album art /
          handle), not from the controls. Here, drag-down comes from
          the header (counter + date strip + progress bar above
          this div). The card area below is fully owned by our
          horizontal yes/no swipe handlers, so the user's natural
          finger-arc on a swipe-right (which inevitably has some
          downward component) stops being interpreted by vaul as
          "she wants to close the sheet" and our handlers see it
          cleanly. */}
      <div
        data-vaul-no-drag
        className="flex-1 flex items-stretch justify-center p-3 overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className={cn(
            "w-full max-w-lg flex",
            // CSS transition only during the post-release phase (snap-
            // back or fly-out). While the user is actively dragging,
            // dragX/dragY change on every pointermove — chaining a
            // 300 ms tween onto each step made the card visibly trail
            // the finger and "shake" on slow, thoughtful drags.
            (isAnimating || (dragX === 0 && dragY === 0)) && "transition-transform duration-300",
            swipeDirection === "right" && "translate-x-[120%] rotate-12",
            swipeDirection === "left" && "-translate-x-[120%] -rotate-12",
            swipeDirection === "down" && "translate-y-[120%] opacity-50",
            isAnimating && !swipeDirection && "opacity-0"
          )}
          style={{
            transform: !isAnimating && (dragX || dragY)
              ? `translateX(${dragX}px) translateY(${Math.max(0, dragY)}px) rotate(${dragX * 0.04}deg)`
              : undefined
          }}
        >
          <div className="relative w-full flex">
            <Card className="card-premium overflow-hidden shadow-2xl flex-1 flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                {/* Top: category badge (compact) + optional new badge */}
                <div className="flex items-start justify-between gap-2 flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className="text-[11px] px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: `hsl(var(--${categoryColor}) / 0.15)`,
                      color: `hsl(var(--${categoryColor}))`
                    }}
                  >
                    {(() => {
                      const QIcon = getTrackerIcon(currentQuestion.tracker.title, currentQuestion.tracker.category);
                      return <QIcon className="h-3 w-3 mr-1 inline-block" strokeWidth={1.75} />;
                    })()}
                    {t(`categories.${currentQuestion.tracker.category}` as const)}
                  </Badge>
                  {currentQuestion.isNew && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {t("dailySession.newSuggestion")}
                    </Badge>
                  )}
                </div>

                {/* Question — fills the card vertically, big serif type */}
                <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
                    {localizeTrackerTitle(currentQuestion.tracker.title)}
                  </p>
                  <p className="font-serif text-2xl sm:text-3xl font-medium leading-snug text-foreground">
                    {localizeTrackerQuestion(currentQuestion.tracker.questionText)}
                  </p>
                </div>

                {/* "Don't show these" link — tiny, only for new suggestions */}
                {currentQuestion.isNew && (
                  <div className="flex justify-center pb-2 flex-shrink-0">
                    <button
                      onClick={handleDisableRecommendations}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      {t("dailySession.dontShowThese")}
                    </button>
                  </div>
                )}

                {/* Subtle swipe hints — minimalist, faded */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 pt-2 flex-shrink-0">
                  <span>← {t("common.no")}</span>
                  <span>{t("dailySession.skipHint")}</span>
                  <span>{t("common.yes")} →</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom buttons — slimmed so the card area gets more vertical
          room. Skip is a tiny inline text link instead of a full-width
          button (it's already discoverable via swipe-down + the in-card
          hint). No/Yes get default-size pills. */}
      <div className="px-4 pt-2 pb-3 flex-shrink-0 bg-background border-t">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleAnswer(false)}
            disabled={isAnimating}
            className={cn(
              "rounded-full border-2 h-10",
              noColorClass === "strong"
                ? "bg-transparent border-strong/50 hover:bg-strong/10 text-strong"
                : "bg-transparent border-balanced/60 hover:bg-balanced/10 text-balanced"
            )}
          >
            {t("common.no")}
          </Button>
          <Button
            onClick={() => handleAnswer(true)}
            disabled={isAnimating}
            className={cn(
              "rounded-full border-2 h-10",
              yesColorClass === "strong"
                ? "bg-transparent border-strong/50 hover:bg-strong/10 text-strong"
                : "bg-transparent border-balanced/60 hover:bg-balanced/10 text-balanced"
            )}
          >
            {t("common.yes")}
          </Button>
        </div>
        {/* Skip + Close inline at the bottom — both are tiny text
            links so they don't compete with No/Yes for attention, but
            they live near the user's thumb so dismissing the session
            doesn't require reaching to the very top of the screen. */}
        <div className="flex items-center justify-center gap-5 mt-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isAnimating}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            {t("dailySession.skipQuestion")}
          </button>
          <span className="text-muted-foreground/30 text-[11px]">·</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
      </div>
    </BottomSheet>
  );
};
