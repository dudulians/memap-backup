import { useState, useRef, useEffect, useCallback } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { X, ChevronRight, ChevronLeft, Sparkles, Shuffle, Pencil, CalendarDays, BarChart3, Home, Undo2 } from "lucide-react";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { LIFE_STREAMS, LifeStreamTemplate } from "@/lib/lifeStreams";
import { getRelatedQuestions, matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { playSwipeSound } from "@/lib/feedback";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerQuestion, localizeTrackerTheme } from "@/lib/trackerLocalize";
import { track } from "@/lib/analytics";
import { ru as ruLocale } from "date-fns/locale";
import { format } from "date-fns";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { Flame, Clock } from "lucide-react";
import { maybeRequestRating } from "@/lib/appRating";
import { getDoorState, getDoor, doorCounts, strongestContextFact } from "@/lib/doors";
import { echoLine, factLine } from "@/lib/echo";
import { Malu } from "./mw/Malu";
import { Glyph } from "./mw/Glyph";
import { PencilCurl, TopicIcon, tapeVar, topicKind } from "./mw/TopicIcon";
import { tilt } from "./mw/WeekMap";
import { eveningDates, maluStory, RECALL_KEY } from "./mw/TodayTop";
import { FINDINGS_AFTER } from "@/lib/weekMap";
import { findTemplate } from "@/lib/doors";
import { localizeTrackerTitleRaw } from "@/lib/trackerLocalize";

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
  /** Mood door (1.9): "how did today feel?" with four faces answers
   *  this card (a low day) and the anxiety question (this id) at once. */
  feelings?: string;
}

type Feeling = "good" | "okay" | "low" | "anxious";
const FEELINGS: Feeling[] = ["good", "okay", "low", "anxious"];

/** Ids of the mood door's two questions, if the mood door is in use. */
const moodPair = (trackers: Tracker[]): { low: string; anxious: string } | null => {
  const state = getDoorState();
  if (!state) return null;
  const moodId = state.id === "mood" ? state.trackerId : state.extra?.find((x) => x.id === "mood")?.trackerId;
  if (!moodId) return null;
  const tpl = findTemplate("felt-anxious");
  if (!tpl) return null;
  const title = localizeTrackerTitleRaw(tpl.template.title).trim().toLowerCase();
  const anxious = trackers.find((tr) => !tr.archived && tr.title.trim().toLowerCase() === title);
  return anxious ? { low: moodId, anxious: anxious.id } : null;
};

// Session settings from localStorage
const getSessionSettings = () => {
  const data = localStorage.getItem("memap_session_settings");
  const fallback = {
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
    // includeSuggestedQuestions is dropped here too — the auto-
    // injection feature it controlled was removed long ago, so
    // reading it from storage is just dead weight.
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
      // 1.6 SHIFT: not just "10 random questions" — the pool is now
      // weighted toward templates RELATED to what the user already
      // tracks. If the user has "headache" and "drank-alcohol" as
      // active questions, the recommendation engine will surface
      // "slept-enough", "coffee-late", "screen-time-long" etc. (things
      // medically/psychologically tied to those). Falls back to fully-
      // random when the user has no recognisable templates yet (all
      // custom-typed or empty deck).

      // 1.7+ HARD INTERVIEW FILTERS: mirror the same gates that
      // starterGenerator uses, so playMode never offers a kid /
      // partner / expat / sensitive template the user explicitly
      // opted out of. User reported: "I'm male without kids and
      // got the 'wanted a child' question in a random round."
      // Without this layer, playMode pulled from the entire
      // LIFE_STREAMS regardless of context.
      let interviewAnswers: {
        hasKids?: boolean;
        hasPartner?: boolean;
        isExpat?: boolean;
        showSensitive?: boolean;
      } = {};
      try {
        const raw = localStorage.getItem("memap_interview");
        const showSensitive =
          localStorage.getItem("memap_show_sensitive") === "true";
        const parsed = raw ? JSON.parse(raw) : {};
        interviewAnswers =
          parsed && typeof parsed === "object"
            ? { ...parsed, showSensitive }
            : { showSensitive };
      } catch {
        // Safe defaults — gate everything when storage is unreadable.
      }
      const KIDS_HAY = ["kids", "children", "parenting", "child", "ребён", "дет"];
      const PARTNER_HAY = ["partner", "партнёр"];
      const haystack = (tpl: LifeStreamTemplate) =>
        [
          tpl.title,
          tpl.titleRu ?? "",
          tpl.questionText,
          tpl.questionTextRu ?? "",
          tpl.subcategory ?? "",
        ]
          .join(" ")
          .toLowerCase();
      const matchesAny = (hay: string, kws: string[]) =>
        kws.some((k) => hay.includes(k.toLowerCase()));

      const allTemplates = LIFE_STREAMS.flatMap((stream) => {
        // Cluster-level gate — expat cluster is hard-hidden unless
        // user opted in via the onboarding ContextScreen.
        if (stream.gatedBy === "expat" && interviewAnswers.isExpat !== true) {
          return [];
        }
        return stream.templates.filter((tpl) => {
          // Sensitive (intimacy / libido / ex) — opt-in via Settings.
          if (tpl.sensitive && !interviewAnswers.showSensitive) return false;
          const hay = haystack(tpl);
          if (interviewAnswers.hasKids === false && matchesAny(hay, KIDS_HAY))
            return false;
          if (
            interviewAnswers.hasPartner === false &&
            matchesAny(hay, PARTNER_HAY)
          )
            return false;
          return true;
        });
      });

      // Existing trackers — match BY TEMPLATE ID, not just by title.
      // Title-only match used to miss the case where a stored tracker
      // says "Поссорилась с партнёром" (RU) and a candidate is
      // "Argued with partner" (EN) — they're the same template, just
      // localized differently. matchTemplateIdByTitle resolves both
      // sides through LIFE_STREAMS' bilingual fields.
      const existingIds = new Set<string>();
      trackers.forEach((tr) => {
        const tplId = matchTemplateIdByTitle(tr.title);
        if (tplId) existingIds.add(tplId);
      });

      // Recently-played: persisted in localStorage so repeated rounds
      // don't immediately resurface the same templates the user just
      // discarded. Capped at 30 ids (FIFO). User complaint: "I just
      // deleted these and they came back next round" — fixed here.
      const RECENT_KEY = "memap_recent_play_ids";
      const RECENT_CAP = 30;
      const readRecent = (): string[] => {
        try {
          const raw = localStorage.getItem(RECENT_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.slice(0, RECENT_CAP) : [];
        } catch {
          return [];
        }
      };
      const recentIds = new Set(readRecent());

      const relatedTemplates = getRelatedQuestions(trackers.map((tr) => tr.title));
      const relatedIdSet = new Set(relatedTemplates.map((t) => t.id));

      const toPlayItem = (tpl: typeof allTemplates[number]) => ({
        id: `ls-${tpl.id}`,
        title: tpl.title,
        questionText: tpl.questionText,
        category: tpl.category,
        subcategory: tpl.subcategory,
        periodDays: tpl.periodDays,
        threshold: tpl.threshold,
        problemWhen: tpl.problemWhen,
        adviceAboveThreshold: tpl.adviceAboveThreshold,
      });

      // Build pools — exclude existing-by-id AND recently-played.
      // If the recent-played filter would empty everything (small
      // library, user has played a lot), drop the recent filter as a
      // graceful fallback so we never return zero items.
      const baseEligible = allTemplates.filter((tpl) => !existingIds.has(tpl.id));
      let withoutRecent = baseEligible.filter((tpl) => !recentIds.has(tpl.id));
      if (withoutRecent.length < 10) {
        // Library exhausted by recent — fall back to "ignore recent"
        // for this round so the user doesn't get an empty deck.
        withoutRecent = baseEligible;
      }

      const relatedPool = withoutRecent.filter((tpl) => relatedIdSet.has(tpl.id));
      const otherPool = withoutRecent.filter((tpl) => !relatedIdSet.has(tpl.id));

      const shuffle = <T,>(arr: T[]): T[] =>
        [...arr].sort(() => Math.random() - 0.5);

      // 70 % related (up to 7), filled with random from "other" pool.
      // Caps gracefully when related pool is small (e.g. brand-new user).
      const TARGET = 10;
      const relatedTake = Math.min(7, relatedPool.length);
      const fromRelated = shuffle(relatedPool).slice(0, relatedTake);
      const fromOther = shuffle(otherPool).slice(0, TARGET - fromRelated.length);
      const picked = shuffle([...fromRelated, ...fromOther]).map(toPlayItem);

      // Persist this round's ids to the "recently played" tail so the
      // next call to buildDeck excludes them. Strip the "ls-" prefix
      // back to the raw template id.
      try {
        const justPlayedIds = picked.map((p) => p.id.replace(/^ls-/, ""));
        const newRecent = [...justPlayedIds, ...readRecent()].slice(0, RECENT_CAP);
        localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
      } catch {
        // localStorage full or disabled — best-effort, no-op.
      }

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

    const pair = moodPair(trackers);
    if (pair) {
      const low = unansweredQuestions.find((q) => q.tracker.id === pair.low);
      const anxious = unansweredQuestions.find((q) => q.tracker.id === pair.anxious);
      if (low && anxious) {
        return unansweredQuestions
          .filter((q) => q !== anxious)
          .map((q) => (q === low ? { ...q, feelings: pair.anxious } : q));
      }
    }

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
  // Tracks whether the user has ever answered a swipe card on this
  // device. Drives the first-card swipe hint — a gentle left/right
  // wiggle on the card itself + two faint chevrons floating just
  // outside its left and right edges. The hint shows ONLY on the
  // very first card of the very first session, then never again.
  // Persisted to localStorage so a reinstall keeps the user from
  // seeing the wiggle a second time (they already learned).
  const [firstSwipeSeen, setFirstSwipeSeen] = useState(() => {
    try {
      return localStorage.getItem("memap_first_swipe_seen") === "true";
    } catch {
      return false;
    }
  });
  const [newPatternsAdded, setNewPatternsAdded] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "down" | null>(null);
  const [completed, setCompleted] = useState(false);
  // Fire one success haptic + one analytics event when the round
  // transitions to "done", no matter which path triggered it (last
  // answer, last skip, disable-recs). Single source of truth for
  // session-completion side-effects.
  useEffect(() => {
    if (!completed) return;
    haptics.success();
    track("daily_session_completed");
    if (playMode) return;
    // Best moment to ask for a rating: the evening is closed and the
    // echo card below just showed a fact. Delay so the done screen is
    // on screen first; maybeRequestRating does its own gating.
    const timer = window.setTimeout(() => {
      void maybeRequestRating();
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const answeredHistory = useRef<Array<{ trackerId: string; saved: boolean; also?: string }>>([]);
  // What tonight's page looks like so far: one square per card, a
  // sticker for "yes", a pencil curl for "no", empty for skipped.
  const [stamps, setStamps] = useState<Record<string, boolean | null>>({});

  // Record the date the moment a suggestion card is first shown
  useEffect(() => {
    if (deck[currentIndex]?.isNew) {
      patchSessionSettings({ lastRecommendationDate: todayLocal() });
    }
  }, [currentIndex]);


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
    setStamps((prev) => ({ ...prev, [currentQuestion.tracker.id]: value }));

    // Play sound and haptic
    playFeedbackSound(value ? "yes" : "no");
    triggerHaptic("medium");
    setAnsweredCount(prev => prev + 1);

    // Latch the first-swipe-seen flag so the wiggle + chevron hint
    // never appears again. Set regardless of whether the user
    // answered via swipe gesture or by tapping the Yes/No buttons —
    // the discovery has happened either way and the hint's job is
    // done. Best-effort storage write; in-memory state ensures the
    // next card render reflects the change even if storage fails.
    if (!firstSwipeSeen) {
      try {
        localStorage.setItem("memap_first_swipe_seen", "true");
      } catch {
        /* private mode / quota exceeded — non-blocking */
      }
      setFirstSwipeSeen(true);
    }

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
    setStamps((prev) => ({ ...prev, [currentQuestion.tracker.id]: null }));

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

  const handleFeeling = (f: Feeling) => {
    if (isAnimatingRef.current || !currentQuestion?.feelings) return;
    const anxiousId = currentQuestion.feelings;
    const lowId = currentQuestion.tracker.id;
    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection(f === "good" || f === "okay" ? "left" : "right");
    answeredHistory.current.push({ trackerId: lowId, saved: true, also: anxiousId });
    setStamps((prev) => ({ ...prev, [lowId]: f === "low" || f === "anxious" }));
    playFeedbackSound(f === "good" || f === "okay" ? "no" : "yes");
    triggerHaptic("medium");
    setAnsweredCount((prev) => prev + 1);
    (async () => {
      try {
        await onAnswer(lowId, f === "low");
        await onAnswer(anxiousId, f === "anxious");
      } catch (err) {
        console.error("DailySession: feeling save failed", err);
      }
    })();
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) setCurrentIndex((prev) => prev + 1);
      else setCompleted(true);
      setSwipeDirection(null);
      setIsAnimating(false);
      isAnimatingRef.current = false;
      setDragX(0);
      setDragY(0);
      currentDx.current = 0;
      currentDy.current = 0;
    }, 300);
  };

  const triggerConfetti = () => {
    // Malu's world (1.9): the day's stickers are the celebration, and
    // a fight or a drink is never something to throw confetti at.
    if (document.documentElement.dataset.theme?.startsWith("malu")) return;
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

    // Door echo (1.8.0): one counted fact about the door question, so
    // every evening ends with something learned, not just a streak.
    const doorState = playMode ? null : getDoorState();
    const echoDoor = doorState ? getDoor(doorState.id) : undefined;
    const echo =
      doorState && echoDoor && trackers.some((tr) => tr.id === doorState.trackerId && !tr.archived)
        ? {
            counts: doorCounts(doorState, entries),
            fact: strongestContextFact(doorState, trackers, entries),
          }
        : null;
    // The door thing happened today (a fight, a migraine…): Malu with
    // hearts and one warm line instead of a streak celebration.
    const hardDay = !!echo && echo.counts.todayValue === true && selectedDate === todayLocal();

    // Action rows for the Done screen. Each row = icon, title (1.8.0: no subtitle),
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
          onClick: onPlayRandom,
        });
      }
      rows.push({
        key: "note",
        icon: Pencil,
        title: t("dailySession.rowNoteTitle"),
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
        onClick: onComplete,
      });
    } else {
      if (onGoToPatterns) {
        rows.push({
          key: "patterns",
          icon: BarChart3,
          title: t("dailySession.rowPatternsTitle"),
          onClick: onGoToPatterns,
          tone: "primary",
        });
      }
      if (onDateChange) {
        rows.push({
          key: "past-dates",
          icon: CalendarDays,
          title: t("dailySession.rowPastDatesTitle"),
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
          onClick: onPlayRandom,
        });
      }
      rows.push({
        key: "note",
        icon: Pencil,
        title: t("dailySession.rowNoteTitle"),
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
        onClick: onComplete,
      });
    }

    // Malu's world (1.9): the end of the evening pays back in three
    // beats instead of "see you tomorrow": tonight's page of stickers,
    // Malu (and her own little evening), how far the first report is.
    const isToday = selectedDate === todayLocal();
    const dayLabel = isToday
      ? t("dailySession.tonight")
      : (() => {
          const d = format(new Date(selectedDate + "T00:00:00"), "EEEE, d MMMM", { locale: dateLocale });
          return d.charAt(0).toUpperCase() + d.slice(1);
        })();
    const dayStamps = trackers
      .filter((tr) => !tr.archived && tr.source !== "play")
      .map((tr) => {
        const e = entries.find((x) => x.trackerId === tr.id && x.date === selectedDate);
        const local = stamps[tr.id];
        const value = local !== undefined ? local : e?.value;
        const hit = value === undefined || value === null ? null : tr.problemWhen === "yes" ? value : !value;
        return { tr, hit };
      })
      .filter((x) => x.hit !== null);
    const evenings = eveningDates(trackers, entries);
    let recalled = false;
    try {
      recalled = localStorage.getItem(RECALL_KEY) === "true";
    } catch {
      // no storage
    }
    const road = Math.min(FINDINGS_AFTER, evenings.length + (recalled ? 1 : 0));
    const primaryRow = rows.find((r) => r.key === "overview");
    const linkRows = rows.filter((r) => r.key !== "overview" && r.key !== "past-dates");
    const story = isToday && !playMode ? maluStory(t, selectedDate) : "";

    return (
      <BottomSheet
        open
        onOpenChange={(o) => { if (!o) onClose(); }}
        className="h-[95vh] flex flex-col p-0 mw-night mw-room"
        scaleBackground
        ariaTitle="Session complete"
      >
        <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 pt-5 gap-5 animate-fade-in" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
          {/* 1. Tonight's page */}
          {!playMode && dayStamps.length > 0 && (
            <div className="mw-taped w-full max-w-sm px-4 pt-5 pb-4" style={{ ["--tape" as string]: "var(--tape-mood)" }}>
              <p className="mw-display text-[20px]">{dayLabel}</p>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {dayStamps.map(({ tr, hit }, i) => {
                  const kind = topicKind(tr.title, doorState?.trackerId === tr.id ? doorState.id : doorState?.extra?.find((x) => x.trackerId === tr.id)?.id);
                  return (
                    <div key={tr.id} className="mw-cell">
                      {hit ? (
                        <TopicIcon
                          kind={kind}
                          size={38}
                          sticker
                          className="absolute mw-slap"
                          style={{ ["--r" as string]: `${tilt(tr.id + selectedDate)}deg`, transform: `rotate(${tilt(tr.id + selectedDate)}deg)`, animationDelay: `${i * 90}ms` }}
                        />
                      ) : (
                        <span className="mw-slap" style={{ animationDelay: `${i * 90}ms` }}>
                          <PencilCurl size={22} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Malu */}
          <div className="w-full max-w-sm flex items-end gap-2">
            <Malu pose={hardDay ? "hug" : playMode ? "wink" : "cheer"} size={hardDay ? 92 : 108} className="shrink-0 -ml-1" />
            <div className="mw-bubble mb-8 text-[18px] leading-snug">
              {hardDay && echoDoor ? (
                <>
                  {/* "Hard day." would judge a drink, so that door gets only the thanks. */}
                  {echoDoor.id !== "drinking" && <span className="block">{t("doors.hardDayTitle")}</span>}
                  <span className="block">{t("doors.hardDayBody")}</span>
                </>
              ) : story ? (
                <>
                  <span className="block text-[15px] text-muted-foreground">{t("mw.storyLabel")}</span>
                  <span className="block">{story}</span>
                </>
              ) : playMode ? (
                answeredCount === 1 ? t("dailySession.playRoundOne") : t("dailySession.playRoundMany", { count: answeredCount })
              ) : deck.length === 0 && !isToday ? (
                t("dailySession.caughtUpForDate", { date: format(new Date(selectedDate + "T00:00:00"), "d MMMM", { locale: dateLocale }) })
              ) : (
                t("dailySession.caughtUp")
              )}
            </div>
          </div>

          {/* 3. What it adds up to, and how far the first report is */}
          {echo && echoDoor && (
            <EchoCard
              doorId={echoDoor.id}
              line={echoLine(t, echoDoor, echo.counts)}
              fact={echo.fact ? factLine(t, echo.fact) : null}
            />
          )}
          {!playMode && (
            <div className="w-full max-w-sm">
              <p className="mw-display text-[19px]">
                {road < FINDINGS_AFTER ? t("mw.today.roadTitle", { count: FINDINGS_AFTER - road }) : t("mw.today.roadReady")}
              </p>
              <div className="mt-2 flex gap-[3px]" aria-hidden="true">
                {Array.from({ length: FINDINGS_AFTER }, (_, i) => (
                  <span key={i} className={cn("h-3 flex-1 rounded-[3px]", i < road ? "bg-[hsl(var(--mw-brand))]" : "bg-[hsl(var(--mw-grid))]")} />
                ))}
              </div>
            </div>
          )}
          {newPatternsAdded > 0 && (
            <p className="text-[16px] text-muted-foreground">
              {newPatternsAdded === 1
                ? t("dailySession.newPatternsOne")
                : t("dailySession.newPatternsMany", { count: newPatternsAdded })}
            </p>
          )}

          <div className="flex-1 min-h-2" />
          {primaryRow && (
            <button
              type="button"
              onClick={road >= FINDINGS_AFTER && onGoToPatterns && !playMode ? onGoToPatterns : primaryRow.onClick}
              className="mw-btn w-full max-w-sm"
            >
              {road >= FINDINGS_AFTER && onGoToPatterns && !playMode ? t("mw.done.seeReport") : t("mw.done.goodNight")}
            </button>
          )}
          <div className="flex flex-wrap justify-center gap-x-2 -mt-1">
            {linkRows
              .filter((row) => !(row.key === "patterns" && road >= FINDINGS_AFTER))
              .map((row) => (
                <button key={row.key} type="button" onClick={row.onClick} className="mw-link">
                  {row.title}
                </button>
              ))}
            {road >= FINDINGS_AFTER && onGoToPatterns && !playMode && primaryRow && (
              <button type="button" onClick={primaryRow.onClick} className="mw-link">
                {t("mw.done.goodNight")}
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  // Malu's world (1.9): night paper, the question taped on as a note
  // with its topic sticker, Yes / No as two equal paper buttons (no
  // right/wrong colours), and a row of squares at the top that fills
  // with a sticker or a pencil curl after every answer.
  const doorNow = getDoorState();
  const doorOf = (id: string) =>
    !doorNow ? undefined : doorNow.trackerId === id ? doorNow.id : doorNow.extra?.find((x) => x.trackerId === id)?.id;
  const kindOf = (tr: Tracker) => topicKind(tr.title, doorOf(tr.id));
  const currentKind = kindOf(currentQuestion.tracker);
  const answerButton =
    "h-16 rounded-[14px] bg-[hsl(var(--mw-paper))] text-foreground text-[20px] font-semibold flex items-center justify-center gap-2 shadow-[0_0_0_1.5px_hsl(var(--mw-grid)),0_8px_14px_-10px_rgb(0_0_0/0.6)] active:scale-[0.97] transition-transform disabled:opacity-50";

  return (
    <BottomSheet
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      className="h-[95vh] flex flex-col p-0 mw-night mw-room"
      scaleBackground
      hideClose
      ariaTitle={t("dailySession.questionOf", { current: currentIndex + 1, total: totalQuestions })}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pb-2 pt-2 flex-shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          {/* Undo: pops the answered-history stack, clears that answer. */}
          <div className="w-10 h-10 flex items-center justify-start">
            {currentIndex > 0 && (
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  const last = answeredHistory.current.pop();
                  if (last) {
                    setStamps((prev) => {
                      const next = { ...prev };
                      delete next[last.trackerId];
                      return next;
                    });
                  }
                  if (last?.saved && onClearAnswer) {
                    onClearAnswer(last.trackerId, selectedDate).catch((err) => {
                      console.warn("[DailySession] onClearAnswer failed", err);
                    });
                    if (last.also) {
                      onClearAnswer(last.also, selectedDate).catch(() => {});
                    }
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
                className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-foreground/10 disabled:opacity-50"
              >
                <Glyph kind="back" size={22} />
              </button>
            )}
          </div>
          <p className="mw-display text-[19px] text-center">
            {selectedDate === todayLocal()
              ? t("dailySession.tonight")
              : (() => {
                  const d = format(new Date(selectedDate + "T00:00:00"), "EEEE, d MMMM", { locale: dateLocale });
                  return d.charAt(0).toUpperCase() + d.slice(1);
                })()}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-foreground/10"
          >
            <Glyph kind="close" size={22} />
          </button>
        </div>

        {/* Date strip: last 7 days, tap one to answer for it. */}
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
                return (
                  <button
                    key={iso}
                    onClick={() => { haptics.tap(); onDateChange(iso); }}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center py-1 rounded-[8px] transition-all",
                      isSelected ? "bg-[hsl(var(--mw-brand))] text-[#2E2433] -rotate-2 shadow-[0_0_0_2px_#fff]" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-[13px] font-semibold">{format(date, "EEEEEE", { locale: dateLocale })}</span>
                    <span className={cn("text-[17px] font-semibold tabular-nums", isToday && !isSelected && "text-foreground")}>{dayNum}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Tonight's page so far: one square per card. */}
        {!playMode && (
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(totalQuestions, 10)}, minmax(0, 1fr))` }} aria-hidden="true">
            {deck.slice(0, 10).map((q, i) => {
              const v = stamps[q.tracker.id];
              const hit = v === undefined || v === null ? null : q.tracker.problemWhen === "yes" ? v : !v;
              return (
                <div
                  key={q.tracker.id}
                  className="mw-cell !aspect-square"
                  data-today={i === currentIndex ? "true" : undefined}
                >
                  {hit === true && (
                    <TopicIcon
                      kind={kindOf(q.tracker)}
                      size={30}
                      sticker
                      className="absolute mw-slap"
                      style={{ ["--r" as string]: `${tilt(q.tracker.id)}deg`, transform: `rotate(${tilt(q.tracker.id)}deg)` }}
                    />
                  )}
                  {hit === false && <span className="mw-slap"><PencilCurl size={18} /></span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card area: swipe right = yes, left = no, down = skip. The
          region opts out of vaul's drag (data-vaul-no-drag) so swipes
          don't close the sheet. */}
      <div
        data-vaul-no-drag
        className="flex-1 flex items-stretch justify-center px-4 pt-5 pb-3 overflow-hidden relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {!firstSwipeSeen && currentIndex === 0 && !swipeDirection && !isAnimating && !currentQuestion.feelings && (
          <>
            <span aria-hidden="true" className="ds-first-chev absolute left-0.5 top-1/2 text-muted-foreground/60 pointer-events-none"><Glyph kind="left" size={26} /></span>
            <span aria-hidden="true" className="ds-first-chev absolute right-0.5 top-1/2 text-muted-foreground/60 pointer-events-none"><Glyph kind="right" size={26} /></span>
          </>
        )}
        <div
          className={cn(
            "w-full max-w-lg flex",
            (isAnimating || (dragX === 0 && dragY === 0)) && "transition-transform duration-300",
            !firstSwipeSeen && currentIndex === 0 && !swipeDirection && !isAnimating && !currentQuestion.feelings && "ds-first-wiggle",
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
          <div
            className="mw-taped relative w-full flex-1 flex flex-col px-6 pt-8 pb-6"
            style={{ ["--tape" as string]: tapeVar(currentKind), transform: `rotate(${tilt(currentQuestion.tracker.id) / 5}deg)` }}
          >
            {currentQuestion.isNew && (
              <span className="mw-hand self-start text-[17px] text-muted-foreground">{t("dailySession.newSuggestion")}</span>
            )}
            <TopicIcon kind={currentKind} size={64} sticker className="-ml-1" style={{ transform: "rotate(-6deg)" }} />
            <div className="flex-1 flex flex-col justify-center">
              <p className="mw-display text-[31px] leading-[1.16] text-foreground [text-wrap:balance]">
                {currentQuestion.feelings
                  ? t("doors.feel.title")
                  : localizeTrackerQuestion(currentQuestion.tracker.questionText, currentQuestion.tracker.title)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="px-4 pt-2 flex-shrink-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        {currentQuestion.feelings ? (
          <div className="grid grid-cols-2 gap-3">
            {FEELINGS.map((f) => (
              <button key={f} type="button" onClick={() => handleFeeling(f)} disabled={isAnimating} className={answerButton}>
                <FeelingFace kind={f} />
                {t(`doors.feel.${f}`)}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => handleAnswer(false)} disabled={isAnimating} className={answerButton}>
              <PencilCurl size={22} />
              {t("common.no")}
            </button>
            <button type="button" onClick={() => handleAnswer(true)} disabled={isAnimating} className={answerButton}>
              <TopicIcon kind={currentKind} size={30} />
              {t("common.yes")}
            </button>
          </div>
        )}
        <div className="mt-1 flex justify-center">
          <button type="button" onClick={handleSkip} disabled={isAnimating} className="mw-link disabled:opacity-50">
            {t("common.skip")}
          </button>
        </div>
      </div>
      </div>
    </BottomSheet>
  );
};

/** Four hand-drawn faces for the mood card. */
const FeelingFace = ({ kind }: { kind: Feeling }) => {
  const fill = kind === "good" ? "#CFE6C4" : kind === "okay" ? "#FFF1C4" : kind === "low" ? "#C9E8F7" : "#D9D0F7";
  const mouth =
    kind === "good" ? "M10.5 18.6c3 2.6 8 2.6 11 0"
      : kind === "okay" ? "M11 19.4h10"
      : kind === "low" ? "M10.8 21.2c3-2.8 7.4-2.8 10.4 0"
      : "M10 19.8c1.1-1.2 2.2-1.2 3.3 0s2.2 1.2 3.3 0 2.2-1.2 3.3 0 2.2 1.2 3.3 0";
  return (
    <svg aria-hidden="true" width={30} height={30} viewBox="0 0 32 32" fill="none" stroke="#5A3624" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4.6c6.4 0 11.2 4.8 11.2 11.3S22.4 27.4 16 27.4 4.8 22.4 4.8 15.9 9.6 4.6 16 4.6z" fill={fill} />
      <circle cx="12" cy="13.4" r="1.5" fill="#5A3624" stroke="none" />
      <circle cx="20" cy="13.4" r="1.5" fill="#5A3624" stroke="none" />
      <path d={mouth} />
    </svg>
  );
};

// "So far" card on the evening done screen for door users. Counts and
// facts only; the amber label keeps it honest until the correlation
// engine has enough days to say anything real.
const EchoCard = ({
  doorId,
  line,
  fact,
}: {
  doorId: string;
  line: string;
  fact: string | null;
}) => {
  const { t } = useTranslation();
  useEffect(() => {
    track("echo_shown", { door: doorId, kind: fact ? "fact" : "count", surface: "evening" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mw-taped w-full max-w-sm px-[18px] pt-5 pb-4" style={{ ["--tape" as string]: tapeVar(topicKind("", doorId as never)) }}>
      <p className="mw-hand text-[17px] text-muted-foreground">{t("doors.echo.soFar")}</p>
      <p className="mt-1 mw-display text-[22px] leading-tight">{line}</p>
      {fact && (
        <>
          <p className="mt-2 text-[18px] leading-snug">{fact}</p>
          <p className="mt-2 mw-hand text-[16px] text-muted-foreground">{t("doors.echo.early")}</p>
        </>
      )}
    </div>
  );
};
