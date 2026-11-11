import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CHOSEN_ONLY_IDS } from "@/lib/researchTemplates";
import { templateIdOf } from "@/lib/answerPhrases";
import { followUpNotNeeded, pathModel } from "@/lib/pathSteps";
import { getUiMode } from "@/lib/uiMode";
import { SupportSheet } from "./SupportSheet";
import { HOME_HARM_IDS, MOOD_SUPPORT_IDS } from "@/lib/supportLines";
import { reasonAskedLater, reasonTemplate } from "@/lib/reasons";
import { createPortal } from "react-dom";
import { Tracker, TrackerEntry, askedOn } from "@/types/tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { X, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, ArrowRight, Sparkles, Shuffle, Pencil, CalendarDays, BarChart3, Home, Undo2, Check } from "lucide-react";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { isPlayful } from "@/lib/playful";
import { LIFE_STREAMS, LifeStreamTemplate } from "@/lib/lifeStreams";
import { getRelatedQuestions, matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { getEntries, getTrackers, saveTrackers } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { playSwipeSound, preloadSounds } from "@/lib/feedback";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerQuestion, localizeTrackerTheme } from "@/lib/trackerLocalize";
import { track, useScreen } from "@/lib/analytics";
import { ru as ruLocale } from "date-fns/locale";
import { format } from "date-fns";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { Pressable } from "@/components/ui/pressable";
import { art, artOf, islandEvenings } from "@/lib/globeArt";
import { islandDef, islandName, islandOf, mapPic } from "@/lib/islands";
import { islandHsl } from "@/lib/islandColors";
import { cardQuestion } from "@/lib/cardText";
import { Flame, Clock, Moon } from "lucide-react";
import { experimentOver, runningExperiments } from "@/lib/experiments";
import { testTodayOf } from "@/lib/testWords";
import { maybeRequestRating } from "@/lib/appRating";
import { getDoorState, getDoor, doorCounts, strongestContextFact, isoLocal } from "@/lib/doors";
import { echoLine, factLine } from "@/lib/echo";
import maluCheer from "@/assets/malu/malu-cheer.webp";
import maluHeart from "@/assets/malu/malu-heart.webp";
import { SHOW_MASCOT } from "@/lib/mascot";

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
  // Aurora "steps, not evenings" (Nov 2 2026): answer only these questions
  // (one topic on Today's path), named by stepTitle in the header. The
  // session then ends on a small "Done" card instead of the evening's.
  onlyIds?: string[];
  stepTitle?: string;
  // Change answers (her note: "если заполнил в 9 вечера, а потом заболела
  // голова"): answered questions come too, each card shows the answer now.
  includeAnswered?: boolean;
  /** onboarding v7's first check-in: no "Done" card, straight to "Your world has begun" */
  autoComplete?: boolean;
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
  onlyIds,
  stepTitle,
  includeAnswered = false,
  autoComplete = false,
}: DailySessionProps) => {
  const { t } = useTranslation();
  useScreen(playMode ? "play" : "questions");
  // The swipe sounds, ready before the first card goes.
  useEffect(() => { preloadSounds("swipeYes", "swipeNo", "swipeSkip"); }, []);
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
          // Intimacy questions are never offered (Nov 7 2026).
          if (tpl.sensitive || tpl.private || tpl.askOnly || tpl.quiet || CHOSEN_ONLY_IDS.has(tpl.id)) return false;
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
    // Same set the path counts (eveningPath activeTrackers): play-round
    // cards stay out of the evening until she keeps them.
    const only = onlyIds ? new Set(onlyIds) : null;
    const unansweredQuestions = trackers
      .filter(tracker => !tracker.archived && tracker.source !== "play" && askedOn(tracker, selectedDate) && (!only || only.has(tracker.id)))
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
      .filter(q => includeAnswered || q.existingAnswer === undefined);

    // Auto-injected "new suggestion" cards have been removed. The user
    // gets new ideas only via:
    //   a) the "Idea of the day" carousel on the Cards screen (with an
    //      explicit "+ Add to my map" button), and
    //   b) the Shuffle button (🎲) which opens an explicit play round.
    // Daily session now contains only the user's own trackers — no
    // surprise cards appear without the user asking for them.
    return unansweredQuestions;
  }, [trackers, entries, selectedDate, onlyIds, includeAnswered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deck rebuilds when selectedDate changes — that lets the date-strip in
  // the header navigate to other days without unmounting the session.
  const [deck, setDeck] = useState<SessionQuestion[]>(() => buildDeck());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  // how the evening went (Nov 8 2026): "not sure" taps and how long it took
  const notSureCount = useRef(0);
  const startedAt = useRef(Date.now());
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
  // The step that finished a week says so (QA, Nov 8 2026: the 7th evening said only "your next step is
  // waiting"): read fresh from storage, since today's answers may not be in the props yet.
  const [weekDone, setWeekDone] = useState<{ week: number; first: boolean } | null>(null);
  useEffect(() => {
    if (!completed) return;
    let live = true;
    // only the step that completed it: the week wasn't complete before this step's answers
    const before = pathModel(trackers, entries).weekComplete;
    void Promise.all([getTrackers(), getEntries()]).then(([trs, ens]) => {
      const pm = pathModel(trs, ens);
      if (live && !before && pm.weekComplete) setWeekDone({ week: pm.week, first: pm.week === 0 && pm.prior === 0 });
    }).catch(() => { /* the plain line stays */ });
    return () => { live = false; };
  }, [completed]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fire one success haptic + one analytics event when the round
  // transitions to "done", no matter which path triggered it (last
  // answer, last skip, disable-recs). Single source of truth for
  // session-completion side-effects.
  useEffect(() => {
    if (!completed) return;
    haptics.success();
    track("daily_session_completed", {
      answered: answeredCount, not_sure: notSureCount.current, cards: deck.length,
      seconds: Math.round((Date.now() - startedAt.current) / 1000), hour: new Date().getHours(),
      kind: playMode ? "play" : onlyIds ? "step" : "all",
    });
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
    // another day: the calm window after a partner-harm "yes" stays with that day's cards (Nov 10 2026 check)
    setCare(null);
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
  const answeredHistory = useRef<Array<{ trackerId: string; saved: boolean; index: number }>>([]);

  // Record the date the moment a suggestion card is first shown
  useEffect(() => {
    if (deck[currentIndex]?.isNew) {
      patchSessionSettings({ lastRecommendationDate: todayLocal() });
    }
  }, [currentIndex]);


  const currentQuestion = deck[currentIndex];
  const totalQuestions = deck.length;

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

  // the answers given in this sitting, so a follow-up knows whether to come
  const sessionVals = useRef(new Map<string, boolean>());
  /** the next card to show from i on: a follow-up whose question got a "no" is passed by */
  const nextOpen = (from: number) => {
    for (let i = from; i < deck.length; i++) {
      const tr = deck[i].tracker;
      if (!followUpNotNeeded(tr, trackers, (pid) => sessionVals.current.get(pid) ?? entries.find((e) => e.trackerId === pid && e.date === selectedDate)?.value)) return i;
    }
    return -1;
  };
  const [support, setSupport] = useState(false);
  // which question the support sheet speaks to, and the calm line after a hurtful "yes"
  const [supportAbout, setSupportAbout] = useState<string | null>(null);
  // the calm line after a partner-harm "yes" is a window of its own, once a sitting (her note, Nov 10 2026: under
  // the buttons it squeezed the cards — "можно просто как разовое окно сделать?"): the question it is about, or null
  const [care, setCare] = useState<string | null>(null);
  const careShown = useRef(false);
  // after such a "yes" the evening doesn't celebrate (persona walk, Nov 9 2026: the calm line came up under falling confetti)
  const hurtTonight = useRef(false);
  // "Why?" (her answer, Nov 9 2026: "чтоб это было очевидно при ответе — типа сможешь добавить причину позже"):
  // a "yes" to a fight or a headache gets one quiet line under the buttons, nothing to tap; the path asks later.
  // It stays a few seconds (it stands under the next card by then, so it names its answer: "Fight: you can add
  // the reason later.", Nov 10 2026) and never under a partner-harm card or its calm line, where "why" would read
  // as being about that one. Only for a day the "Why?" step will still ask about (reasonAskedLater). The Done
  // card says it again, unless a partner-harm "yes" came this sitting.
  const [whyLater, setWhyLater] = useState<{ at: number; id: string } | null>(null);
  const whyAsked = useRef(false);
  useEffect(() => {
    if (!whyLater) return;
    const id = window.setTimeout(() => setWhyLater(null), 5000);
    return () => window.clearTimeout(id);
  }, [whyLater]);

  const handleAnswer = (value: boolean) => {
    if (isAnimatingRef.current || !currentQuestion || care) return;
    sessionVals.current.set(currentQuestion.tracker.id, value);
    const why = value && !playMode && reasonAskedLater(currentQuestion.tracker, selectedDate, isoLocal(new Date()));
    const whyId = why ? reasonTemplate(currentQuestion.tracker) : null;
    setWhyLater(whyId ? { at: Date.now(), id: whyId } : null);
    if (whyId) whyAsked.current = true;
    // a partner shouted or said something hurtful: one calm line before the next card (persona walk, Nov 9 2026:
    // the deck went straight on to "Great work today!")
    const tid = templateIdOf(currentQuestion.tracker) ?? "";
    if (value && HOME_HARM_IDS.has(tid)) {
      hurtTonight.current = true; confetti.reset();
      if (!careShown.current) { careShown.current = true; setCare(tid); }
    }

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection(value ? "right" : "left");

    // Record for Undo. saved=true because handleAnswer always writes
    // (even on isNew suggestion cards — those create a new tracker
    // first via getTrackers/saveTrackers, then save the answer).
    answeredHistory.current.push({
      trackerId: currentQuestion.tracker.id,
      saved: true,
      index: currentIndex,
    });

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
      const next = nextOpen(currentIndex + 1);
      if (next >= 0) {
        setCurrentIndex(next);
      } else {
        setCompleted(true);
        if (!onlyIds) triggerConfetti();
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
    if (isAnimatingRef.current || !currentQuestion || care) return;
    setWhyLater(null);

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setSwipeDirection("down");

    // Record for Undo. saved=false because skip doesn't write any
    // entry — Undo just navigates back, no clearAnswer call needed.
    answeredHistory.current.push({
      trackerId: currentQuestion.tracker.id,
      saved: false,
      index: currentIndex,
    });

    notSureCount.current += 1;
    // Play sound and haptic
    playFeedbackSound("skip");
    triggerHaptic("light");
    
    setTimeout(() => {
      const next = nextOpen(currentIndex + 1);
      if (next >= 0) {
        setCurrentIndex(next);
      } else {
        setCompleted(true);
        if (answeredCount > 0 && !onlyIds) {
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
    // not over a hurt evening, and not with "Games and rewards" off (Nov 9 2026)
    if (hurtTonight.current || !isPlayful()) return;
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

  // Past the line where letting go answers: one light swipe haptic each
  // time the finger crosses it (plan §3.3), not on every move.
  const crossedRef = useRef(false);
  // evenings answered on each island: the question card shows its island at its stage
  const islandEveningsMap = useMemo(() => islandEvenings(trackers, entries) as Map<string, number>, [trackers, entries]);
  // the 7 days in sight at once, to answer for any of them (her note, Nov 6 2026:
  // "заполнять за прошлые дни, как у меня было"); the title still folds them away
  const [showDates, setShowDates] = useState(() => !!onDateChange);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    crossedRef.current = false;
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
    const over = Math.abs(dx) >= 50;
    if (over !== crossedRef.current) {
      crossedRef.current = over;
      if (over) haptics.swipe();
    }
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

  // A night test's step for tonight, said on the Done card of today's check-in.
  const tonightSteps = completed && !playMode && selectedDate === isoLocal(new Date())
    ? runningExperiments().filter((x) => x.night && !experimentOver(x)).map((x) => testTodayOf(x.change, x)).filter((s): s is string => !!s).slice(0, 2)
    : [];

  // The calm window after a partner-harm "yes": over the next card, or over Done when it was the last one.
  // Above the Done card (z-60); "Talk to someone" opens the support sheet above both (z-[80]).
  const carePopup = care ? createPortal(
    // pointer-events-auto: the deck's sheet turns pointer events off on <body> while it is open, and this window lives in
    // <body> too — on a phone every tap went through it to the cards (her note, Nov 10 2026: "Talk to someone не работает")
    <div className="pointer-events-auto fixed inset-0 z-[75] flex items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-fade-in sm:items-center" role="presentation">
      <div data-care-window role="dialog" aria-modal="true" aria-label={t("support.chip")} className="surface w-full max-w-sm rounded-[24px] px-5 pb-5 pt-6 text-left shadow-[0_22px_40px_-18px_rgba(16,42,56,0.45)]">
        <p className="text-[19px] font-bold leading-snug tracking-tight">{t("support.careLine")}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Pressable tone="teal" haptic="tap" onClick={() => { setSupportAbout(care); setCare(null); setSupport(true); }} className="h-[52px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold">
            {t("support.chip")}
          </Pressable>
          <button type="button" onClick={() => setCare(null)} className="h-11 w-full text-[16px] font-semibold text-muted-foreground">{t("common.close")}</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  // A step (one topic) ends on a small card: what was done, then back to
  // the path, where the next step is waiting (after the calm window, when one is open).
  if (completed && autoComplete) {
    if (care) return carePopup;
    window.setTimeout(onComplete, 0);
    return null;
  }
  // the new look always ends on its own "Done!" card (persona walk, Nov 9 2026: after answering for
  // yesterday in the morning, the old look's streak sheet with confetti came up)
  if (completed && (onlyIds || includeAnswered || getUiMode() === "new")) {
    return <>{createPortal(
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-6 text-center animate-fade-in">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white shadow-[0_6px_0_hsl(var(--lip-teal))]">
          <Check className="h-12 w-12" strokeWidth={3.2} />
        </span>
        <p className="mt-6 text-[28px] font-bold tracking-tight">{t("path.stepDone")}</p>
        <p className="mt-1 text-[17px] font-medium text-muted-foreground">
          {weekDone !== null ? t(weekDone.first ? "path.weekSaved" : "path.weekSavedN", { n: weekDone.week + 1 }) : t("path.stepSaved", { count: answeredCount })}
        </p>
        {/* a fight or a headache this sitting: the reasons can come later, on the path ("Why?") */}
        {whyAsked.current && !hurtTonight.current && <p data-why-later className="mt-3 text-[16px] font-semibold text-muted-foreground">{t("why.later")}</p>}
        {/* tonight's step of a night test (her note, Nov 10 2026: "не забудь сегодня лечь так, чтоб было 8 часов"): its
            question comes tomorrow evening, about last night */}
        {tonightSteps.length > 0 && (
          <div data-tonight className="mt-5 w-full max-w-sm space-y-2">
            {tonightSteps.map((s) => (
              <p key={s} className="flex items-start justify-center gap-2 text-[17px] font-bold leading-snug">
                <Moon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />{s}
              </p>
            ))}
          </div>
        )}
        <Pressable tone="teal" haptic="medium" onClick={onComplete} className="mt-8 h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
          {t("path.continue")}
        </Pressable>
        <SupportSheet open={support} onClose={() => setSupport(false)} about={supportAbout} layer="z-[80]" />
      </div>,
      document.body,
    )}{carePopup}</>;
  }

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
        <div className="flex-1 overflow-y-auto flex flex-col items-center px-5 pt-6 gap-6 animate-fade-in" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
          {/* Hero moment — Malu (1.8.0, was a 🎉 emoji) + the streak
              number. On a hard day she shows hearts and the streak gives
              way to one kind line: no celebrating the evening a fight
              was logged. The PNG has air around the lamb, hence the
              negative margins. */}
          <div className="flex flex-col items-center text-center space-y-3">
            {SHOW_MASCOT && (
              <img
                src={hardDay ? maluHeart : maluCheer}
                alt=""
                aria-hidden="true"
                className="h-[160px] w-[160px] -mt-4 -mb-6"
              />
            )}
            {hardDay && echoDoor ? (
              <div className="flex flex-col items-center">
                {/* "Hard day." would judge a drink, so that door gets only the thanks. */}
                {echoDoor.id !== "drinking" && (
                  <p className="text-[22px] font-bold tracking-tight">{t("doors.hardDayTitle")}</p>
                )}
                <p className="mt-1 text-base text-muted-foreground">{t("doors.hardDayBody")}</p>
              </div>
            ) : streak.currentStreak > 0 && (
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
            {!hardDay && (
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
                // Real plural forms, no "(а)" (Aurora step 4); classic keeps its own strings.
                ? t("path.answers", { count: answeredCount })
                : t("dailySession.seeYouTomorrow")}
            </p>
            )}
            {newPatternsAdded > 0 && (
              <p className="text-xs text-primary">
                {newPatternsAdded === 1
                  ? t("dailySession.newPatternsOne")
                  : t("dailySession.newPatternsMany", { count: newPatternsAdded })}
              </p>
            )}
          </div>

          {echo && echoDoor && (
            <EchoCard
              doorId={echoDoor.id}
              line={echoLine(t, echoDoor, echo.counts)}
              fact={echo.fact ? factLine(t, echo.fact) : null}
            />
          )}

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
                          <p className={cn("text-base font-semibold", primary && "text-primary")}>{row.title}</p>
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
                            "relative after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-0.5 after:w-1.5 after:h-1.5 after:rounded-full after:bg-[hsl(var(--coin-gold))]",
                          partiallyFilled:
                            "relative after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-0.5 after:w-1.5 after:h-1.5 after:rounded-full after:border after:border-[hsl(var(--coin-gold))]",
                        }}
                      />
                      {/* Tiny legend so the dots are self-explanatory. */}
                      <div className="flex items-center gap-3 px-3 pt-1 pb-2 text-[10px] text-muted-foreground border-t">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--coin-gold))]" />
                          {t("dailySession.legendFilled")}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full border border-[hsl(var(--coin-gold))]" />
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
                    <p className={cn("text-base font-semibold", primary && "text-primary")}>
                      {row.title}
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

  // Yes / No are the same calm buttons (1.8.0). Colouring them by which
  // answer is "the problem" read as right / wrong answers (design review,
  // Oct 27): the evening question is for honesty, not a test.
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
      <div className="px-4 pb-2 pt-2 flex-shrink-0 space-y-2">
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
              visibly trembles every time the user starts a swipe.
              Visibility is gated only by currentIndex; isAnimating
              just disables interaction (don't unmount on every swipe
              animation — that flickered the button in/out as the
              user reported). */}
          <div className="w-9 h-9 flex items-center justify-start">
            {currentIndex > 0 && (
              <button
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  const last = answeredHistory.current.pop();
                  setWhyLater(null);
                  if (last?.saved && onClearAnswer) {
                    // Fire-and-forget like handleAnswer — never block
                    // the UI on a save/delete round-trip.
                    onClearAnswer(last.trackerId, selectedDate).catch((err) => {
                      console.warn("[DailySession] onClearAnswer failed", err);
                    });
                    setAnsweredCount((c) => Math.max(0, c - 1));
                  }
                  // back to the card that was answered, not just one step: a follow-up that was
                  // passed by sits in between (audit, Nov 7 2026)
                  if (last) {
                    sessionVals.current.delete(last.trackerId);
                    // a partner-harm "yes" taken back: the evening may celebrate again, unless another one stands (Nov 10 2026 check)
                    const harm = (id: string) => { const tr = trackers.find((x) => x.id === id); return !!tr && HOME_HARM_IDS.has(templateIdOf(tr) ?? ""); };
                    if (harm(last.trackerId) && ![...sessionVals.current].some(([id, v]) => v === true && harm(id))) {
                      setCare(null); hurtTonight.current = false;
                    }
                  }
                  setCurrentIndex((prev) => (last ? last.index : Math.max(0, prev - 1)));
                  setSwipeDirection(null);
                  setIsAnimating(false);
                  isAnimatingRef.current = false;
                  setDragX(0);
                  setDragY(0);
                  currentDx.current = 0;
                  currentDy.current = 0;
                }}
                aria-label={t("dailySession.previousQuestion")}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
          <div className="text-center">
            {/* A past day is named in the title itself ("Friday, 30 October")
                instead of a tiny "filling in for" line under it. Tapping it
                shows the date strip (hidden by default since Aurora step 3). */}
            <button type="button" disabled={!onDateChange} onClick={() => { haptics.tap(); setShowDates((v) => !v); }}
              aria-expanded={showDates} className="inline-flex items-center gap-1 whitespace-nowrap text-[17px] font-bold">
              {stepTitle && selectedDate === todayLocal()
                ? stepTitle
                : selectedDate === todayLocal()
                ? t("dailySession.tonight")
                : (() => {
                    const s = format(new Date(selectedDate + "T00:00:00"), "EEE, d MMM", { locale: dateLocale });
                    return s.charAt(0).toUpperCase() + s.slice(1);
                  })()}
              {onDateChange && <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showDates && "rotate-180")} strokeWidth={2.4} />}
            </button>
            {/* which question of how many, on its own line (her note, Nov 8 2026: "Health 1/2 · 3 of 8") */}
            <p className="text-[13px] font-semibold text-muted-foreground">{t("dailySession.questionOf", { current: currentIndex + 1, total: totalQuestions })}</p>
            {/* Which day the questions are about (her note, Nov 3 2026: a
                card says "Felt anxious", and it wasn't clear: today? ever?).
                A past day is already named in the title. */}
            {selectedDate !== todayLocal() && (
              // answering for another day: say which, so "Did you…?" is about that day (QA, Nov 8 2026)
              <p className="text-[14px] font-bold text-[hsl(var(--coin-teal))]">{t("dailySession.aboutDay", { day: format(new Date(selectedDate + "T00:00:00"), "EEEE, d MMMM", { locale: dateLocale }) })}</p>
            )}
            {selectedDate === todayLocal() && (
              <p className="text-[14px] font-bold text-[hsl(var(--coin-teal))]">{t("dailySession.aboutToday")}</p>
            )}
          </div>
          <div className="w-9 h-9" />
        </div>

        {/* Date strip — last 7 days. Tap any to answer for that date.
            Future dates are excluded — you can't pre-fill tomorrow. */}
        {onDateChange && showDates && (() => {
          const todayStr = todayLocal();
          // which days already have answers: a gold dot; a missed one: an empty ring
          const ids = new Set(trackers.filter((tr) => !tr.archived).map((tr) => tr.id));
          const answered = new Set(entries.filter((e) => ids.has(e.trackerId)).map((e) => e.date));
          // no days before her first one (QA, Nov 8 2026: day 1 showed five empty days before she started)
          const firstDay = [...answered, getDoorState()?.startedAt ?? todayStr, selectedDate].filter(Boolean).sort()[0];
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return { iso, dayNum: d.getDate(), date: d };
          }).filter((x) => x.iso >= firstDay);
          if (days.length < 2) return null;
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
                        ? "surface text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{weekday}</span>
                    <span className={cn(
                      "text-base font-semibold tabular-nums",
                      isToday && !isSelected && "text-foreground"
                    )}>{dayNum}</span>
                    <span aria-hidden="true" className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", answered.has(iso) ? "bg-[#F6B92B]" : "ring-[1.5px] ring-inset ring-foreground/25")} />
                  </button>
                );
              })}
            </div>
          );
        })()}
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
        className="flex-1 flex items-stretch justify-center p-3 overflow-hidden relative select-none [-webkit-touch-callout:none]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {/* First-card-ever swipe hint: faint monochrome chevrons just
            outside the card's left/right edges. Sit on the outer
            pointer container so they DON'T move with the card during
            drag — they stay as fixed reference markers while the
            card slides toward / away from them. Disappear forever
            once the user has answered any card. */}
        {!firstSwipeSeen && currentIndex === 0 && !swipeDirection && !isAnimating && (
          <>
            <ChevronLeft
              aria-hidden="true"
              className="ds-first-chev absolute z-10 left-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground/50 pointer-events-none"
              strokeWidth={2}
            />
            <ChevronRight
              aria-hidden="true"
              className="ds-first-chev absolute z-10 right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground/50 pointer-events-none"
              strokeWidth={2}
            />
          </>
        )}
        {/* The deck (Aurora step 3): the next two cards peek from behind
            and the second one rises while the top card flies off; the top
            card is keyed by index, so a new card never flies back in from
            the side. A slate YES/NO stamp follows the drag. */}
        <div className="relative w-full max-w-lg flex pb-5">
          {[2, 1].map((depth) => {
            const q = deck[currentIndex + depth];
            if (!q) return null;
            const rising = depth === 1 && !!swipeDirection;
            return (
              <div
                key={q.tracker.id}
                aria-hidden="true"
                className="absolute inset-x-0 top-0 bottom-5 flex transition-transform duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
                style={{ transformOrigin: "50% 100%", transform: rising ? "none" : `translateY(${depth * 10}px) scale(${1 - depth * 0.05})` }}
              >
                <DeckCard question={q} evenings={islandEveningsMap} />
              </div>
            );
          })}
          <div
            key={currentIndex}
            className={cn(
              "relative w-full flex",
              // CSS transition only during the post-release phase (snap-
              // back or fly-out). While the user is actively dragging,
              // dragX/dragY change on every pointermove — chaining a
              // 300 ms tween onto each step made the card visibly trail
              // the finger and "shake" on slow, thoughtful drags.
              (isAnimating || (dragX === 0 && dragY === 0)) && "transition-transform duration-300",
              // Only while the card rests: a running animation beats the inline
              // drag transform, so the wiggle froze the card under the finger.
              !firstSwipeSeen && currentIndex === 0 && !swipeDirection && !isAnimating && dragX === 0 && dragY === 0 && "ds-first-wiggle",
              swipeDirection === "right" && "translate-x-[120%] rotate-12",
              swipeDirection === "left" && "-translate-x-[120%] -rotate-12",
              swipeDirection === "down" && "translate-y-[120%] opacity-50",
              isAnimating && !swipeDirection && "opacity-0",
            )}
            style={{
              transform: !isAnimating && (dragX || dragY)
                ? `translateX(${dragX}px) translateY(${Math.max(0, dragY)}px) rotate(${dragX * 0.04}deg)`
                : undefined,
            }}
          >
            <DeckCard evenings={islandEveningsMap}
              question={currentQuestion}
              stamp={
                swipeDirection === "right" || swipeDirection === "left"
                  ? { yes: swipeDirection === "right", opacity: 1 }
                  : Math.abs(dragX) > 6
                  ? { yes: dragX > 0, opacity: Math.min(1, Math.abs(dragX) / 90) }
                  : null
              }
            />
          </div>
        </div>
      </div>

      <div
        className="px-4 pt-1 flex-shrink-0 bg-background"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        {/* Hints, not buttons (Aurora step 3): flat, slate, the dragged
            side darkens. Tapping one answers too. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleAnswer(false)}
            disabled={isAnimating}
            className={cn("h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[16px] font-semibold transition-colors disabled:opacity-60",
              dragX < -20 ? "bg-foreground/[0.12] text-foreground" : "bg-foreground/[0.05] text-muted-foreground")}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
            {t("common.no")}
          </button>
          <button
            type="button"
            onClick={() => handleAnswer(true)}
            disabled={isAnimating}
            className={cn("h-11 rounded-2xl flex items-center justify-center gap-1.5 text-[16px] font-semibold transition-colors disabled:opacity-60",
              dragX > 20 ? "bg-foreground/[0.12] text-foreground" : "bg-foreground/[0.05] text-muted-foreground")}
          >
            {t("common.yes")}
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        {whyLater && !care && !HOME_HARM_IDS.has(templateIdOf(currentQuestion.tracker) ?? "") && (
          <p key={whyLater.at} data-why-later role="status" className="mt-2.5 text-center text-[15px] font-semibold leading-snug text-muted-foreground animate-fade-in">{t("why.laterOne", { name: t(`why.one.${whyLater.id}`) })}</p>
        )}
        {carePopup}
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isAnimating}
            className="h-10 px-4 text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {t("dailySession.notSure")}
          </button>
          {/* (the "Something worrying?" red-flag list was removed Nov 10 2026: MeMap is self-tracking, not medical
              triage — her content audit) */}
          {/* mood questions: a free line to talk to someone (safety round, Nov 7 2026) */}
          {/* not twice: the calm line above already has it */}
          {!care && MOOD_SUPPORT_IDS.has(templateIdOf(currentQuestion.tracker) ?? "") && (
            <button type="button" onClick={() => { setSupportAbout(templateIdOf(currentQuestion.tracker)); setSupport(true); }} className="h-10 px-4 text-[15px] font-medium text-muted-foreground hover:text-foreground">
              {t("support.chip")}
            </button>
          )}
        </div>
        <SupportSheet open={support} onClose={() => setSupport(false)} about={supportAbout} />
      </div>
      </div>
    </BottomSheet>
  );
};

// One evening card (Aurora step 3, plan §3.3): solid surface tinted with
// the island's colour at the top, a slate lip, the island chip and picture
// (the same one the Map uses), then the question, big. The stamp says YES
// or NO in slate: the two never differ in colour.
const DeckCard = ({ question, stamp, evenings }: { question: SessionQuestion; stamp?: { yes: boolean; opacity: number } | null; evenings?: Map<string, number> }) => {
  const { t } = useTranslation();
  const island = islandOf(question.tracker);
  const hsl = islandHsl(island);
  // the island as it looks on her map now (Nov 5 2026: the old flat picture was left here)
  const pic = artOf(island, evenings?.get(island) ?? 0);
  const text = cardQuestion(question.tracker);
  const small = typeof window !== "undefined" && window.innerHeight < 720;
  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden rounded-[28px] border border-[var(--surface-border)]"
      style={{
        background: `linear-gradient(180deg, hsl(${hsl} / 0.12) 0%, hsl(${hsl} / 0) 42%), hsl(var(--surface))`,
        boxShadow: "0 6px 0 hsl(var(--lip-slate)), 0 22px 40px -22px rgba(16, 42, 56, 0.45)",
      }}
    >
      <div className="flex items-center gap-2 px-5 pt-5">
        <img src={mapPic("icon_" + islandDef(island).icon)} alt="" width={30} height={30} decoding="async" draggable={false} className="pointer-events-none" />
        <span className="text-[15px] font-bold text-foreground/80">{islandName(t, island)}</span>
        {question.existingAnswer !== undefined && (
          <span className="ml-auto rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[13px] font-semibold text-muted-foreground">
            {t("path.nowAnswer", { answer: question.existingAnswer ? t("common.yes") : t("common.no") })}
          </span>
        )}
        {question.isNew && (
          <Badge className="ml-auto bg-primary/20 text-primary border-primary/30 text-[13px] px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            {t("dailySession.newSuggestion")}
          </Badge>
        )}
      </div>
      <div className="flex justify-center pt-1">
        <span aria-hidden="true" className="block" style={{ width: small ? 150 : 190 }}>
          <img className="art-day block w-full" src={art(pic, false)} alt="" />
          <img className="art-night block w-full" src={art(pic, true)} alt="" />
        </span>
      </div>
      <div className="flex flex-1 items-center px-6 pb-6">
        <p className={cn("font-bold leading-[1.14] tracking-tight text-foreground [text-wrap:balance]",
          text.length <= 50 ? "text-[30px]" : text.length <= 80 ? "text-[26px]" : "text-[23px]")}>
          {text}
        </p>
      </div>
      {stamp && (
        <span
          aria-hidden="true"
          className={cn("pointer-events-none absolute top-6 rounded-xl border-4 border-[hsl(var(--muted-foreground))] bg-[hsl(var(--surface)/0.85)] px-3 py-0.5 text-[26px] font-black uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]",
            stamp.yes ? "left-5 -rotate-12" : "right-5 rotate-12")}
          style={{ opacity: stamp.opacity }}
        >
          {stamp.yes ? t("common.yes") : t("common.no")}
        </span>
      )}
    </div>
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
    track("echo_shown", { kind: fact ? "fact" : "count", surface: "evening" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="w-full max-w-sm rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-[18px] py-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("doors.echo.soFar")}</p>
      <p className="mt-2.5 text-[22px] leading-tight font-bold tracking-tight">{line}</p>
      {fact && (
        <>
          <p className="mt-2.5 text-lg leading-snug">{fact}</p>
          <span className="mt-3.5 inline-flex items-center gap-2 h-[30px] px-3 rounded-full border border-emerging/70 text-emerging text-[13px] font-semibold">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
            {t("doors.echo.early")}
          </span>
        </>
      )}
    </div>
  );
};
