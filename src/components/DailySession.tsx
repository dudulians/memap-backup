import { useState, useRef, useEffect, useCallback } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { X, ChevronRight, Sparkles, Shuffle, Pencil, CalendarDays, BarChart3, Home } from "lucide-react";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { TEMPLATE_GROUPS } from "@/lib/templateGroups";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { playSwipeSound, triggerHaptic as runHaptic } from "@/lib/feedback";
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
  const fallback = { includeSuggestedQuestions: true, soundEnabled: true, lastRecommendationDate: null as string | null };
  if (!data) return fallback;
  try { return { ...fallback, ...JSON.parse(data) }; } catch { return fallback; }
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

// Haptic feedback — uses native @capacitor/haptics on iOS/Android (required
// on iOS since `navigator.vibrate` is a no-op there), falls back to the
// Web Vibration API in browsers.
const triggerHaptic = (type: "light" | "medium" | "heavy") => {
  const settings = getSessionSettings();
  if (!settings.soundEnabled) return;
  runHaptic(type);
};

export const DailySession = ({
  trackers,
  entries,
  selectedDate,
  onAnswer,
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

    // Step 2: Add new suggested questions if enabled and not yet shown today.
    // Only inject suggestions when the user is answering for *today* —
    // "try this new pattern" doesn't make sense when back-filling a past date.
    let newQuestions: SessionQuestion[] = [];
    const isTodaySession = selectedDate === todayLocal();
    if (isTodaySession && settings.includeSuggestedQuestions && settings.lastRecommendationDate !== todayLocal()) {
      const allTemplates = TEMPLATE_GROUPS.flatMap(group => group.templates);
      const existingTitles = new Set(trackers.map(t => t.title.toLowerCase().trim()));

      const availableTemplates = allTemplates.filter(
        t => !existingTitles.has(t.title.toLowerCase().trim())
      );

      // Shuffle and take at most 1 per day
      const shuffled = availableTemplates.sort(() => Math.random() - 0.5);
      const selectedTemplates = shuffled.slice(0, 1);

      newQuestions = selectedTemplates.map(template => ({
        tracker: {
          id: `new-${template.id}`,
          title: template.title,
          questionText: template.questionText,
          category: template.category,
          subcategory: template.subcategory,
          periodDays: template.periodDays,
          threshold: template.threshold,
          problemWhen: template.problemWhen,
          adviceAboveThreshold: template.adviceAboveThreshold,
          answerType: "boolean" as const,
          createdAt: new Date().toISOString(),
        },
        isNew: true,
        templateId: template.id,
      }));
    }

    return [...unansweredQuestions, ...newQuestions];
  }, [trackers, entries, selectedDate, settings.includeSuggestedQuestions]);

  // Deck rebuilds when selectedDate changes — that lets the date-strip in
  // the header navigate to other days without unmounting the session.
  const [deck, setDeck] = useState<SessionQuestion[]>(() => buildDeck());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [newPatternsAdded, setNewPatternsAdded] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "down" | null>(null);
  const [completed, setCompleted] = useState(false);
  // Sheet-style drag-down-to-dismiss: track Y translation of the whole
  // session when the user grabs the drag-handle pill at the top.
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStartY = useRef<number | null>(null);
  const sheetPointerId = useRef<number | null>(null);
  // iOS-style tap/drag disambiguation refs for the Done sheet — used
  // by onDoneDragStart/Move/End/ClickCapture below. Must live at the
  // component top level (hooks rule), not inside the `if (completed)`
  // branch where they're consumed.
  const isDraggingRef = useRef(false);
  const wasDraggingRef = useRef(false);

  const onSheetDragStart = (e: React.PointerEvent) => {
    // Don't hijack pointer-down that lands on an interactive element —
    // X close button, date-strip day buttons, etc. need their own taps
    // to fire normally. The drag-down dismiss only fires from empty
    // header space.
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[role='button']") || target.closest("a") || target.closest("input")) {
      return;
    }
    e.stopPropagation();
    sheetPointerId.current = e.pointerId;
    sheetDragStartY.current = e.clientY;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onSheetDragMove = (e: React.PointerEvent) => {
    if (sheetPointerId.current !== e.pointerId || sheetDragStartY.current === null) return;
    e.stopPropagation();
    const dy = e.clientY - sheetDragStartY.current;
    setSheetDragY(Math.max(0, dy));
  };
  const onSheetDragEnd = (e: React.PointerEvent) => {
    if (sheetPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    sheetPointerId.current = null;
    sheetDragStartY.current = null;
    if (sheetDragY > 100) {
      // Past the dismiss threshold — fade and close
      setSheetDragY(window.innerHeight);
      setTimeout(() => { setSheetDragY(0); onClose(); }, 220);
    } else {
      setSheetDragY(0);
    }
  };

  // Re-pull deck whenever the selected date changes via the date-strip.
  // Clearing answeredCount here would lie about progress within a single
  // mount, so we keep it; only the cards for the new day are reloaded.
  // BUT in playMode the deck must stay frozen for the duration of the
  // round — otherwise every answer mutates `trackers`, which changes
  // `buildDeck`, which would re-shuffle and re-include cards the user
  // already skipped. Each new round gets a fresh deck via a parent
  // `key` change, not via this effect.
  useEffect(() => {
    if (playMode) return;
    setDeck(buildDeck());
    setCurrentIndex(0);
    setCompleted(false);
  }, [selectedDate, buildDeck, playMode]);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const activePointerId = useRef<number | null>(null);
  const currentDx = useRef(0);
  const currentDy = useRef(0);
  const isAnimatingRef = useRef(false);

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
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnimatingRef.current) return;
    const target = e.target as HTMLElement;
    // Let buttons & interactive controls handle their own clicks
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;
    if (activePointerId.current !== null) return;

    activePointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

    // Two ways to register a horizontal swipe:
    //   1) Distance — moved at least 50px and the swipe is mostly horizontal
    //   2) Velocity — fast flick (>=0.5 px/ms) with at least 25px of travel
    // Either path is forgiving so the user doesn't have to drag all the way
    // across the card; a quick wrist-flick works too.
    const distanceTrigger = absX >= 50 && absX >= absY * 0.7;
    const velocityTrigger = velocityX >= 0.5 && absX >= 25 && absX >= absY * 0.5;

    if (distanceTrigger || velocityTrigger) {
      if (dx > 0) handleAnswer(true); else handleAnswer(false);
      return;
    }
    // Skip-down stays strict — only a clearly intentional, mostly-vertical
    // downward drag of 150+ counts as skip. Diagonal Yes/No takes priority.
    if (dy > 150 && absY > absX * 1.5) {
      handleSkip();
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
    const yesterdayIso = (() => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    })();

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
          key: "yesterday",
          icon: CalendarDays,
          title: t("dailySession.rowYesterdayTitle"),
          subtitle: t("dailySession.rowYesterdaySubtitle"),
          onClick: () => onDateChange(yesterdayIso),
        });
      }
      if (onPlayRandom) {
        rows.push({
          key: "random",
          icon: Shuffle,
          title: t("dailySession.rowRandomTitle"),
          subtitle: t("dailySession.rowRandomSubtitle"),
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

    // iOS-style sheet dismiss: drag starts from anywhere on the sheet
    // body — including action rows. Differentiator from "tap" is total
    // movement: if the finger barely moved, it's a tap (button fires
    // normally); if it moved past a small drag-start threshold (10px
    // vertical), we take over as a drag. Past 180px → dismiss.
    //
    // Why a two-stage threshold:
    //   – 10px (DRAG_START): below this, ignore — let button taps work.
    //   – 180px (DISMISS):   below this, snap back; above, close.
    //
    // We also need to swallow the click event that would normally fire
    // on the row the user pressed on — if the drag took over, the
    // implicit pointerup → click should not bubble. `wasDragging` flag
    // is read by an onClickCapture handler at the wrapper.
    const DRAG_START_PX = 10;
    const DISMISS_PX = 180;

    const onDoneDragStart = (e: React.PointerEvent) => {
      sheetPointerId.current = e.pointerId;
      sheetDragStartY.current = e.clientY;
      isDraggingRef.current = false;
    };
    const onDoneDragMove = (e: React.PointerEvent) => {
      if (sheetPointerId.current !== e.pointerId || sheetDragStartY.current === null) return;
      const dy = e.clientY - sheetDragStartY.current;
      if (dy <= DRAG_START_PX && !isDraggingRef.current) return;
      if (!isDraggingRef.current) {
        // crossed the start threshold — take over as a drag
        isDraggingRef.current = true;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      setSheetDragY(Math.max(0, dy));
    };
    const onDoneDragEnd = (e: React.PointerEvent) => {
      if (sheetPointerId.current !== e.pointerId) return;
      const wasDrag = isDraggingRef.current;
      if (wasDrag) {
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      sheetPointerId.current = null;
      sheetDragStartY.current = null;
      isDraggingRef.current = false;

      if (wasDrag) {
        // Suppress the click event that would otherwise fire on the
        // row under the finger when the user "tapped and dragged".
        wasDraggingRef.current = true;
        // Clear the flag in the next tick — by then click will have
        // either fired (and been swallowed) or never reached us.
        setTimeout(() => { wasDraggingRef.current = false; }, 50);

        if (sheetDragY > DISMISS_PX) {
          setSheetDragY(window.innerHeight);
          setTimeout(() => { setSheetDragY(0); onClose(); }, 220);
        } else {
          setSheetDragY(0);
        }
      } else {
        setSheetDragY(0);
      }
    };
    // Capture-phase click handler runs BEFORE the row's onClick. If
    // we just finished a drag, swallow the click so the action menu
    // doesn't fire spuriously.
    const onDoneClickCapture = (e: React.MouseEvent) => {
      if (wasDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    return (
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] h-auto rounded-t-3xl overflow-y-auto p-0 flex flex-col"
          style={{
            transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined,
            transition: sheetPointerId.current === null ? "transform 0.22s ease" : "none",
          }}
        >
        <div
          className="flex flex-col items-center px-5 pt-10 pb-6 gap-6 animate-fade-in"
          onPointerDown={onDoneDragStart}
          onPointerMove={onDoneDragMove}
          onPointerUp={onDoneDragEnd}
          onPointerCancel={onDoneDragEnd}
          onClickCapture={onDoneClickCapture}
        >
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
                ? t("dailySession.caughtUp")
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
              return (
                <button
                  key={row.key}
                  onClick={row.onClick}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all active:scale-[0.99]",
                    primary
                      ? "bg-primary/10 border border-primary/30 hover:bg-primary/15"
                      : "bg-muted/30 border border-transparent hover:bg-muted/50"
                  )}
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
        </SheetContent>
      </Sheet>
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
    <div
      className="fixed inset-0 bg-background z-50 flex flex-col"
      style={{
        touchAction: "none",
        transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined,
        transition: sheetPointerId.current === null ? "transform 0.22s ease" : "none",
        opacity: sheetDragY > 0 ? Math.max(0, 1 - sheetDragY / window.innerHeight) : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {/* Header — drag-handle pill + counter row are wrapped in a
          large invisible drag region. Anywhere on this region (except
          the X button) accepts a swipe-down to dismiss. The X still
          taps to close, the pill itself can also be tapped to close. */}
      <div
        className="px-4 pt-2 pb-2 border-b flex-shrink-0 space-y-2 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onPointerDown={onSheetDragStart}
        onPointerMove={onSheetDragMove}
        onPointerUp={onSheetDragEnd}
        onPointerCancel={onSheetDragEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center pt-0.5 pb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-12 h-1.5 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors"
          />
        </div>
        <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t("common.close")}
          className="rounded-full bg-muted/40 hover:bg-muted h-9 w-9"
        >
          <X className="h-5 w-5" />
        </Button>
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
        <div className="w-9" />
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
                    onClick={() => onDateChange(iso)}
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

      {/* Card area — take all available vertical space, near-edge-to-edge
          width, Tinder/Hinge feel. Card itself fills the container so the
          question is huge and the gesture surface is massive. */}
      <div className="flex-1 flex items-stretch justify-center p-3 overflow-hidden">
        <div
          className={cn(
            "w-full max-w-lg transition-transform duration-300 flex",
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
          {/* Swipe indicators — pinned to the card's corners. Appear at
              30px so the user gets early "you're heading the right way"
              confirmation before the 50px action threshold. Opacity ramps
              up from 30→50 so the badge fades in proportional to commitment. */}
          <div className="relative w-full flex">
            {dragX > 30 && (
              <div
                className={cn(
                  "absolute top-6 left-6 px-4 py-2 rounded-full font-bold text-lg uppercase tracking-wider z-10 rotate-[-12deg] border-4 transition-opacity",
                  yesIsSignificant ? "border-strong text-strong" : "border-balanced text-balanced"
                )}
                style={{ opacity: Math.min(1, (dragX - 30) / 20) }}
              >
                {t("common.yes")}
              </div>
            )}
            {dragX < -30 && (
              <div
                className={cn(
                  "absolute top-6 right-6 px-4 py-2 rounded-full font-bold text-lg uppercase tracking-wider z-10 rotate-[12deg] border-4 transition-opacity",
                  yesIsSignificant ? "border-balanced text-balanced" : "border-strong text-strong"
                )}
                style={{ opacity: Math.min(1, (-dragX - 30) / 20) }}
              >
                {t("common.no")}
              </div>
            )}
            {dragY > 80 && (
              <div className="absolute left-1/2 bottom-6 -translate-x-1/2 bg-muted text-muted-foreground px-4 py-2 rounded-full font-semibold animate-fade-in z-10">
                {t("common.skip")} ↓
              </div>
            )}

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
              "rounded-full h-10",
              yesColorClass === "strong"
                ? "bg-strong hover:bg-strong/90 text-strong-foreground"
                : "bg-balanced hover:bg-balanced/90 text-balanced-foreground"
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
  );
};
