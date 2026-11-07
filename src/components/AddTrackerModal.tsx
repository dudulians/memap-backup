import { useState, useRef, useEffect } from "react";
import { AnswerWordsFields, cleanWords, type AnswerWords } from "./AnswerWordsFields";
import { createPortal } from "react-dom";
import { Tracker, ProblemWhen } from "@/types/tracker";
import { track } from "@/lib/analytics";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { TEMPLATE_GROUPS } from "@/lib/templateGroups";
import {
  localizeTrackerTitle,
  localizeTrackerQuestion,
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
  localizeGroupTitle,
  localizeTrackerTheme,
} from "@/lib/trackerLocalize";
import { asQuestion, templateQuestion } from "@/lib/cardText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategoryColor } from "@/lib/categoryHelpers";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { Search, Plus, X, Check, ArrowUp, ArrowLeft, ChevronDown } from "lucide-react";
import { DuplicateTrackerDialog } from "./DuplicateTrackerDialog";
import { toast } from "@/hooks/use-toast";
import { uuid } from "@/lib/uuid";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { RuleChips } from "@/components/RuleChips";
import { ruleKeyOf } from "@/lib/rules";

interface AddTrackerModalProps {
  open: boolean;
  onClose: () => void;
  onTrackerAdded: () => void;
  onNavigateToTracker?: (tracker: Tracker) => void;
}

// Cluster id → underlying Tracker.category. Used by the Custom-tracker
// form: when the user picks a Theme (cluster), we derive the structural
// category for stats/colors automatically. Mapping picks the category
// that BEST matches the dominant data type in each cluster.
const CLUSTER_TO_CATEGORY: Record<string, Tracker["category"]> = {
  partner: "Connections",
  parenting: "Connections",
  health: "Health",
  habits: "Health",
  state: "Emotions",
  "big-decisions": "Voice",
  "external-events": "Social",
  expat: "Voice",
};

/**
 * The "+" on a library row. It is only a picture now: the whole row is one
 * button (her note, Nov 5 2026: tapping "+" did nothing, only the question
 * worked). The old "+" listened to pointerup and click; on a phone the click
 * came after its guard reset, so one tap added the question and took it
 * straight back. A plain click on the row also ignores scroll gestures.
 */
const AddBadge = ({ added, locked }: { added?: boolean; locked?: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors",
      locked ? "bg-foreground/[0.06] text-muted-foreground"
        : added ? "bg-[hsl(var(--coin-teal))] text-white" : "icon-dot",
    )}
  >
    {added ? <Check className="h-[18px] w-[18px]" strokeWidth={2.8} /> : <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />}
  </span>
);

// Shared dropdown for the Custom-tab title and question autocomplete.
// Anchors absolutely under the wrapper (parent must be `relative`).
// Renders a small "Похожее в библиотеке" header followed by up to 5
// template hits. onPick fires before the parent input's blur-close
// thanks to onMouseDown + preventDefault in the row's handler.
type AutocompleteRow = {
  id: string;
  title: string;
  questionText: string;
  category: Tracker["category"];
  subcategory?: string;
  periodDays: number;
  threshold: number;
  problemWhen: ProblemWhen;
  adviceAboveThreshold: string;
};

const AutocompleteDropdown = ({
  headerLabel,
  suggestions,
  onPick,
  t,
}: {
  headerLabel: string;
  suggestions: AutocompleteRow[];
  onPick: (template: AutocompleteRow) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) => (
  <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg z-50 max-h-[280px] overflow-y-auto">
    <div className="px-3 py-2 border-b border-border/40">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {headerLabel}
      </p>
    </div>
    <div className="py-1">
      {suggestions.map((template) => {
        const categoryColor = getCategoryColor(template.category);
        return (
          <button
            key={template.id}
            type="button"
            // onMouseDown beats onClick to onBlur — ensures the pick
            // fires before the input's blur-to-close triggers and
            // unmounts the list. preventDefault also stops the
            // input from losing focus needlessly.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(template);
            }}
            className="w-full flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer text-left"
          >
            <div className="flex-1 min-w-0">
              {/* Question prominent, title secondary — same hierarchy
                  as Today/TrackerDetails (1.7+). User scans the
                  question to recognize the template; title is the
                  short ID. */}
              <p className="font-medium text-sm leading-snug line-clamp-2 break-words">
                {templateQuestion(template)}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="text-xs flex-shrink-0"
              style={{
                backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                color: `hsl(var(--${categoryColor}))`,
              }}
            >
              {localizeTrackerTheme(template)}
            </Badge>
          </button>
        );
      })}
    </div>
  </div>
);

export const AddTrackerModal = ({
  open,
  onClose,
  onTrackerAdded,
  onNavigateToTracker,
}: AddTrackerModalProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"templates" | "custom">("templates");

  // "More settings" on the own-question form (name, theme, limit,
  // advice). Folded by default: one field and Good/Bad is enough.
  const [moreOpen, setMoreOpen] = useState(false);
  // Library rows added in this visit, so their "+" turns into a tick; a
  // second tap takes it back (her note: "должна иметь возможность обратно
  // отжать"). Which question each one made, to undo exactly that.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const addedMade = useRef(new Map<string, { id: string; restored: boolean }>());
  // Library questions she already has: a quiet tick, never a duplicate window.
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    getTrackers().then((ts) => setExistingIds(new Set(ts.filter((x) => !x.archived).map((x) => matchTemplateIdByTitle(x.title)).filter((x): x is string => !!x))));
  }, [open]);

  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTracker, setDuplicateTracker] = useState<Tracker | null>(null);
  const [duplicateIsArchived, setDuplicateIsArchived] = useState(false);
  const [pendingTracker, setPendingTracker] = useState<Tracker | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    questionText: "",
    category: "Curious" as Tracker["category"],
    // Subcategory carried for autocomplete: when the user picks a
    // library template via the title-field autocomplete, the
    // template's subcategory ("Pain", "Sleep", "Cycle", ...) gets
    // pre-filled here. The custom form doesn't expose subcategory
    // as an editable field — it just rides along to the final
    // tracker so suggestion-picks preserve their parentage.
    subcategory: undefined as string | undefined,
    // Cluster id (lifeStreams). User picks via the "Theme" dropdown
    // OR auto-fills when picking a library template. Empty means
    // user hasn't picked a theme — when submitting we'll fall back
    // to category="Curious" (the default neutral bucket).
    cluster: undefined as string | undefined,
    periodDays: 30,
    threshold: 0,
    problemWhen: "yes" as "yes" | "no",
    adviceAboveThreshold: "",
  });
  // her answers in words, for links (optional; Nov 7 2026)
  const [words, setWords] = useState<AnswerWords>({});
  // Per-cluster "show all" state. When false → only featured (3 picks)
  // are shown inside the expanded cluster; user taps "Показать все N →"
  // to reveal the rest. Reset every time the modal opens so the user
  // re-enters into a clean discovery state.
  const [expandedFull, setExpandedFull] = useState<Record<string, boolean>>({});
  // Autocomplete dropdown state for the Custom-tab inputs. Shows
  // matching library templates as the user types — Google-style: type
  // "го" → see "Болела голова", "Готовил(а) сам(а)", etc. Pick one
  // and the entire tracker (title, question, category, period,
  // threshold, advice) gets pre-filled — user reviews / edits then
  // hits Add. Two separate booleans because both the title and
  // question fields have their own dropdown — only one is open at a
  // time (focusing one closes the other so we don't have stacked
  // overlays).
  const [titleAutocompleteOpen, setTitleAutocompleteOpen] = useState(false);
  const [questionAutocompleteOpen, setQuestionAutocompleteOpen] = useState(false);
  useEffect(() => {
    if (!open) {
      setExpandedFull({});
      setMode("templates");
      setMoreOpen(false);
      setAddedIds(new Set());
      addedMade.current.clear();
      setTitleAutocompleteOpen(false);
      setQuestionAutocompleteOpen(false);
    }
  }, [open]);

  // Read user's interview answers from localStorage. We use these to
  // hide cluster groups the user opted out of (currently: the expat
  // cluster — gated by isExpat === true). Re-read every render so a
  // change in Settings flows through immediately.
  const interviewAnswers: { isExpat?: boolean; showSensitive?: boolean } = (() => {
    try {
      const raw = localStorage.getItem("memap_interview");
      const showSensitive = localStorage.getItem("memap_show_sensitive") === "true";
      if (!raw) return { showSensitive };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? { ...parsed, showSensitive }
        : { showSensitive };
    } catch {
      return {};
    }
  })();

  // Hard-gate clusters by interview answer. Expat cluster ("Жизнь за
  // границей") is hidden unless the user explicitly opted in. Mirrors
  // the same filter in starterGenerator so onboarding suggestions and
  // the Add Tracker library stay in sync.
  const visibleGroups = TEMPLATE_GROUPS.filter((group) => {
    if (group.gatedBy === "expat" && interviewAnswers.isExpat !== true) return false;
    return true;
  });

  // Intimacy questions are never offered (Nov 7 2026), even if the old switch is on.
  const filterSensitive = <T extends { sensitive?: boolean }>(arr: T[]): T[] => arr.filter((t) => !t.sensitive);

  // Get all templates for autocomplete dropdown
  const getAllTemplatesForDropdown = () => {
    let filteredGroups = visibleGroups;

    // Filter by theme
    if (selectedTheme !== "all") {
      filteredGroups = visibleGroups.filter(group => group.id === selectedTheme);
    }

    // Flatten to all templates with group info
    const allTemplates = filteredGroups.flatMap(group =>
      filterSensitive(group.templates).map(template => ({ ...template, groupTitle: group.title }))
    );

    // If there's a search query, filter — match against both English (stored)
    // and Russian (displayed) strings so RU-language users can search in RU.
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return allTemplates.filter(template =>
        template.title.toLowerCase().includes(query) ||
        template.questionText.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query) ||
        localizeTrackerTitle(template.title).toLowerCase().includes(query) ||
        localizeTrackerQuestion(template.questionText).toLowerCase().includes(query)
      );
    }

    return allTemplates;
  };

  const dropdownTemplates = getAllTemplatesForDropdown();

  // Custom-tab autocomplete suggestions. Filters the visible library
  // (same gates as anywhere else: hidden expat cluster, hidden
  // sensitive templates) by typed text. Matches against EN +
  // localized titles AND question text so e.g. "болит" matches both
  // "Болела голова" (title) and "Болит ли спина?" (question). Up to
  // 5 results — more would feel noisy under a single input field.
  // Used by BOTH the title and question inputs, each searching by
  // its own text — pick a suggestion in either dropdown and the
  // whole template mirrors into all fields.
  const computeAutocompleteSuggestions = (query: string) => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const allTemplates = visibleGroups.flatMap((group) =>
      filterSensitive(group.templates).map((template) => ({
        ...template,
        groupTitle: group.title,
      })),
    );
    return allTemplates
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.questionText.toLowerCase().includes(q) ||
          localizeTrackerTitle(t.title).toLowerCase().includes(q) ||
          localizeTrackerQuestion(t.questionText).toLowerCase().includes(q),
      )
      .slice(0, 5);
  };
  const customTitleSuggestions = computeAutocompleteSuggestions(formData.title);
  const customQuestionSuggestions = computeAutocompleteSuggestions(formData.questionText);

  // Check for duplicate trackers (active OR archived). Returns
  // tracker + isArchived so the dialog can offer "Restore from
  // archive" instead of "Open existing" when the match is archived.
  //
  // Two-pass match (1.7.3+):
  //   1. Exact title match (case-insensitive) within the same category.
  //   2. If no hit, route both stored title and incoming title through
  //      `matchTemplateIdByTitle` — if both resolve to the same
  //      template id, treat as duplicate. This catches renames across
  //      versions (legacy "Сегодня голова болела" still maps to the
  //      "headache" template id, same as the current "Болела голова"
  //      title), so the user doesn't end up with two semantically-
  //      identical trackers after a library refresh.
  const checkForDuplicate = async (
    title: string,
    category: Tracker["category"],
    incomingTemplateId?: string,
  ): Promise<{ tracker: Tracker; isArchived: boolean } | null> => {
    const trackers = await getTrackers();
    const normalizedTitle = title.trim().toLowerCase();

    let matches = trackers.filter(
      (t) =>
        t.title.trim().toLowerCase() === normalizedTitle &&
        t.category === category,
    );

    // Pass 2: template-id equivalence. Cheap to compute, only runs
    // when the strict title match found nothing.
    if (matches.length === 0) {
      const targetId =
        incomingTemplateId ?? matchTemplateIdByTitle(title) ?? null;
      if (targetId) {
        matches = trackers.filter(
          (t) => matchTemplateIdByTitle(t.title) === targetId,
        );
      }
    }

    if (matches.length === 0) return null;
    const active = matches.find((t) => !t.archived);
    if (active) return { tracker: active, isArchived: false };
    return { tracker: matches[0], isArchived: true };
  };

  const createTrackerDirectly = async (newTracker: Tracker) => {
    const trackers = await getTrackers();
    await saveTrackers([...trackers, newTracker]);
    setSearchQuery("");

    // Analytics — we track whether it was a library template
    // (cluster set) or a custom user-typed tracker (cluster null).
    // Title / question text are NOT sent — privacy-first.
    track("tracker_added", {
      source: newTracker.cluster ? "template" : "custom",
      category: newTracker.category,
      total_active: trackers.filter((t) => !t.archived).length + 1,
    });

    // No "Question added" popup: the tick on the question shows it.

    onTrackerAdded();
  };

  const handleTemplateSelect = async (template: typeof TEMPLATE_GROUPS[0]["templates"][0]) => {
    // When the user is on Russian, store the localized strings so the tracker
    // persists in the active language from the moment it's created. We use
    // the *Raw variants here so the bracketed neutral form ("сделал(а)")
    // is preserved on disk — polishRu runs at display time and respects
    // the user's current pol, even if it changes later.
    const localizedTitle = localizeTrackerTitleRaw(template.title);
    const localizedQuestion = localizeTrackerQuestionRaw(template.questionText);
    const localizedAdvice = localizeTrackerAdviceRaw(template.adviceAboveThreshold);

    // Find the cluster id for this template — needed so the saved
    // Tracker carries cluster info for correlation semantic verdicts.
    let clusterId: string | undefined;
    for (const stream of LIFE_STREAMS) {
      if (stream.templates.some((t) => t.id === template.id)) {
        clusterId = stream.id;
        break;
      }
    }

    // Check for duplicates (match against the localized title since that's
    // what the user sees and what new trackers get stored as). Pass the
    // template id so the duplicate check can catch renames — e.g. an old
    // stored tracker "Сегодня голова болела" still maps to template id
    // "headache", same as the current title "Болела голова".
    const dup = await checkForDuplicate(localizedTitle, template.category, template.id);

    if (dup) {
      // Already hers: an archived one comes back; an active one just shows
      // as hers (no "duplicate" window, her note on "Argued with partner").
      if (dup.isArchived) {
        const all = await getTrackers();
        await saveTrackers(all.map((x) => (x.id === dup.tracker.id ? { ...x, archived: false } : x)));
        onTrackerAdded();
        return { id: dup.tracker.id, restored: true };
      }
      setExistingIds((prev) => new Set(prev).add(template.id));
      return null;
    }

    // No duplicate - create directly
    const newTracker: Tracker = {
      title: localizedTitle,
      questionText: localizedQuestion,
      category: template.category,
      subcategory: template.subcategory,
      cluster: clusterId,
      periodDays: template.periodDays,
      threshold: template.threshold,
      problemWhen: template.problemWhen,
      adviceAboveThreshold: localizedAdvice,
      answerType: "boolean",
      id: uuid(),
      createdAt: new Date().toISOString(),
    };

    await createTrackerDirectly(newTracker);
    return { id: newTracker.id, restored: false };
  };

  /** Tap a library question: add it; tap again: take it back. */
  // one change at a time per question: a second tap while saving is ignored
  const busy = useRef(new Set<string>());
  const toggleTemplate = async (template: typeof TEMPLATE_GROUPS[0]["templates"][0]) => {
    if (existingIds.has(template.id) || busy.current.has(template.id)) return;
    busy.current.add(template.id);
    try { await toggleNow(template); } finally { busy.current.delete(template.id); }
  };
  const toggleNow = async (template: typeof TEMPLATE_GROUPS[0]["templates"][0]) => {
    const made = addedMade.current.get(template.id);
    if (made) {
      haptics.soft();
      addedMade.current.delete(template.id);
      setAddedIds((prev) => { const n = new Set(prev); n.delete(template.id); return n; });
      const all = await getTrackers();
      // Made just now, so no answers yet: it simply goes (a restored one goes back to the archive).
      await saveTrackers(made.restored ? all.map((x) => (x.id === made.id ? { ...x, archived: true } : x)) : all.filter((x) => x.id !== made.id));
      onTrackerAdded();
      return;
    }
    haptics.pop(0.35);
    const res = await handleTemplateSelect(template);
    if (res) {
      addedMade.current.set(template.id, res);
      setAddedIds((prev) => new Set(prev).add(template.id));
    }
  };

  // Custom-tab autocomplete: user clicked a library suggestion → mirror
  // every field of the chosen template into the custom form, but do NOT
  // submit. The user reviews / edits the pre-filled form and decides
  // whether to add as-is or tweak first. Strings are stored as the
  // *Raw localized variant (gender brackets preserved on disk → polishRu
  // resolves at display time). Period/threshold ALSO update their string
  // mirrors so the number inputs reflect the new values.
  const handleAutocompletePick = (
    template: typeof TEMPLATE_GROUPS[0]["templates"][0],
  ) => {
    // Find cluster id by walking LIFE_STREAMS — needed so the
    // resulting custom-form state carries cluster (which then
    // makes it onto the saved Tracker for correlation purposes).
    let clusterId: string | undefined;
    for (const stream of LIFE_STREAMS) {
      if (stream.templates.some((t) => t.id === template.id)) {
        clusterId = stream.id;
        break;
      }
    }
    setFormData({
      title: localizeTrackerTitleRaw(template.title),
      questionText: localizeTrackerQuestionRaw(template.questionText),
      category: template.category,
      subcategory: template.subcategory,
      cluster: clusterId,
      periodDays: template.periodDays,
      threshold: template.threshold,
      problemWhen: template.problemWhen,
      adviceAboveThreshold: localizeTrackerAdviceRaw(template.adviceAboveThreshold),
    });
    setTitleAutocompleteOpen(false);
    setQuestionAutocompleteOpen(false);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = asQuestion(formData.questionText);
    if (!question) return;
    // The name defaults to the question without "?" (More settings can change it).
    const title = formData.title.trim() || question.replace(/[?？]+$/, "").slice(0, 60);
    const data = { ...formData, title, questionText: question, words: cleanWords(words) };

    // Check for duplicates
    const dup = await checkForDuplicate(data.title, data.category);

    if (dup) {
      const newTracker: Tracker = {
        ...data,
        id: uuid(),
        answerType: "boolean",
        createdAt: new Date().toISOString(),
      };

      setPendingTracker(newTracker);
      setDuplicateTracker(dup.tracker);
      setDuplicateIsArchived(dup.isArchived);
      setDuplicateDialogOpen(true);
      return;
    }

    // No duplicate - create directly
    const newTracker: Tracker = {
      ...data,
      id: uuid(),
      answerType: "boolean",
      createdAt: new Date().toISOString(),
    };

    const trackers = await getTrackers();
    await saveTrackers([...trackers, newTracker]);
    
    // No "Question added" popup: the tick on the question shows it.

    setFormData({
      title: "",
      questionText: "",
      category: "Curious",
      subcategory: undefined,
      cluster: undefined,
      periodDays: 30,
      threshold: 0,
      problemWhen: "yes",
      adviceAboveThreshold: "",
    });
    setWords({});
    setMoreOpen(false);
    onTrackerAdded();
    // Custom-tracker creation is an explicit form submission, so close
    // the modal afterwards. Template additions keep the modal open.
    onClose();
  };

  const handleOpenExisting = () => {
    setDuplicateDialogOpen(false);
    if (duplicateTracker && onNavigateToTracker) {
      onClose();
      onNavigateToTracker(duplicateTracker);
    }
  };

  const handleCreateAnyway = async () => {
    setDuplicateDialogOpen(false);
    if (pendingTracker) {
      await createTrackerDirectly(pendingTracker);
      setPendingTracker(null);
      setDuplicateTracker(null);
    }
  };

  // Filter templates based on theme and search
  const getFilteredTemplates = () => {
    let filteredGroups = visibleGroups;

    // Filter by theme
    if (selectedTheme !== "all") {
      filteredGroups = visibleGroups.filter(group => group.id === selectedTheme);
    }

    // If there's a search query, return flat list of matching templates.
    // Match against both English (stored) and Russian (displayed) strings so
    // Russian-speaking users can search using the terms they see.
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const allTemplates = filteredGroups.flatMap(group =>
        filterSensitive(group.templates).map(template => ({ ...template, groupTitle: group.title }))
      );

      return allTemplates.filter(template =>
        template.title.toLowerCase().includes(query) ||
        template.questionText.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query) ||
        localizeTrackerTitle(template.title).toLowerCase().includes(query) ||
        localizeTrackerQuestion(template.questionText).toLowerCase().includes(query)
      );
    }

    return null; // Return null to indicate grouped display
  };

  const filteredTemplates = getFilteredTemplates();
  const filteredGroups = selectedTheme === "all"
    ? visibleGroups
    : visibleGroups.filter(group => group.id === selectedTheme);

  // Scroll + swipe-to-dismiss state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragActiveId = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [open]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Swipe-down on the drag handle only (so modal scrolling is unaffected)
  const handleHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragActiveId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
  };
  const handleHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragActiveId.current !== e.pointerId || dragStartY.current === null) return;
    const dy = e.clientY - dragStartY.current;
    setDragY(Math.max(0, dy));
  };
  const handleHandlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragActiveId.current !== e.pointerId) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragActiveId.current = null;
    dragStartY.current = null;
    if (dragY > 120) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0);
    }
  };

  if (!open) {
    return (
      <DuplicateTrackerDialog
        open={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        existingTracker={duplicateTracker}
        isArchived={duplicateIsArchived}
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={handleCreateAnyway}
        onRestoreFromArchive={async () => {
          if (!duplicateTracker) return;
          const all = await getTrackers();
          const restored = all.map((t) =>
            t.id === duplicateTracker.id ? { ...t, archived: false } : t,
          );
          await saveTrackers(restored);
          setDuplicateDialogOpen(false);
          setPendingTracker(null);
          setDuplicateTracker(null);
          setDuplicateIsArchived(false);
          // Surface the restored tracker so caller can navigate.
          if (onNavigateToTracker) onNavigateToTracker(duplicateTracker);
          onClose();
          toast({
            title: t("today.restoredFromArchive"),
            description: t("today.restoredFromArchiveDesc"),
          });
        }}
      />
    );
  }

  // On top of everything (it used to sit inside Today's faded scroll area,
  // under the tab bar, her Nov 3 note).
  return createPortal(
    <>
      {/* Custom full-height sheet — swipe down handle to close, sticky header always accessible */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background rounded-t-3xl shadow-2xl animate-fade-in"
        style={{
          // 86vh (was 92vh) — leaves ~14% above the modal so the
          // app header (MeMap) stays visible AND the swipe-to-
          // dismiss area at the top of the modal has more room.
          // User reported "modal covers MeMap, hard to swipe down".
          maxHeight: "86vh",
          height: "86vh",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 0.25s ease",
        }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerEnd}
          onPointerCancel={handleHandlePointerEnd}
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center gap-2 px-5 pt-1 pb-3">
          {mode === "custom" && (
            <Button variant="ghost" size="icon" onClick={() => setMode("templates")} className="-ml-2 rounded-full h-10 w-10" aria-label={t("common.back")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="flex-1 text-[24px] font-bold tracking-tight">
            {mode === "custom" ? t("addTracker.ownTitle") : t("addTracker.title")}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10" aria-label={t("common.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* `overflow-x-hidden` is critical: any row that overflows
            horizontally would otherwise let the whole sheet pan sideways. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 relative">

        {mode === "templates" ? (
          <div className="space-y-4">
            {/* Search: results replace the list below */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={t("addTracker.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 rounded-2xl text-base bg-foreground/[0.06] border-foreground/[0.14]"
              />
            </div>

            {/* Theme chips */}
            {!searchQuery.trim() && (
              <div className="-mx-5 px-5 flex gap-2 overflow-x-auto scrollbar-hide">
                {[{ id: "all", title: "" }, ...visibleGroups].map((group) => {
                  const on = selectedTheme === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedTheme(group.id)}
                      aria-pressed={on}
                      className={cn("chip whitespace-nowrap", on && "is-on")}
                    >
                      {group.id === "all" ? t("addTracker.all") : localizeGroupTitle(group.title)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Rows: short name + "+". Tap the name to look before adding
                (opens it in the own-question form, pre-filled). */}
            {(() => {
              const rows = searchQuery.trim()
                ? (filteredTemplates ?? [])
                : selectedTheme === "all"
                  ? filteredGroups.flatMap((g) => {
                      const list = filterSensitive(g.templates);
                      const featured = list.filter((x) => x.featured);
                      return featured.length ? featured : list.slice(0, 3);
                    })
                  : filteredGroups.flatMap((g) => filterSensitive(g.templates));
              if (rows.length === 0) {
                return <p className="py-8 text-center text-base text-muted-foreground">{t("addTracker.nothingFound")}</p>;
              }
              return (
                <div className="surface overflow-hidden rounded-[22px]">
                  {rows.map((template, i) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => toggleTemplate(template)}
                      disabled={existingIds.has(template.id)}
                      aria-pressed={addedIds.has(template.id) || existingIds.has(template.id)}
                      aria-label={t("addTracker.addAria", { title: templateQuestion(template) })}
                      style={{ touchAction: "manipulation" }}
                      className={cn("flex w-full items-center gap-3 pl-4 pr-3 py-3 text-left active:bg-foreground/[0.04]", i > 0 && "border-t border-foreground/[0.08]")}
                    >
                      <span className="flex-1 min-w-0 text-base font-medium leading-snug">
                        {templateQuestion(template)}
                        {existingIds.has(template.id) && (
                          <span className="block text-[13px] font-medium text-muted-foreground">{t("addTracker.alreadyHave")}</span>
                        )}
                      </span>
                      <AddBadge added={addedIds.has(template.id) || existingIds.has(template.id)} locked={existingIds.has(template.id)} />
                    </button>
                  ))}
                </div>
              );
            })()}

            <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 bg-background/95 backdrop-blur-sm">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    title: "",
                    questionText: "",
                    category: "Curious",
                    subcategory: undefined,
                    cluster: undefined,
                    periodDays: 30,
                    threshold: 0,
                    problemWhen: "yes",
                    adviceAboveThreshold: "",
                  });
                  setMoreOpen(false);
                  setMode("custom");
                }}
                className="w-full h-[52px] rounded-full text-[16px] font-semibold bg-transparent border-foreground/20"
              >
                {t("addTracker.writeOwn")}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="flex flex-col gap-6 min-h-full">
            {/* The question is the only required field. Typing shows
                matching library questions; picking one fills everything. */}
            <div className="relative">
              <Input
                id="questionText"
                aria-label={t("addTracker.fieldQuestion")}
                placeholder={t("addTracker.fieldQuestionPh")}
                value={formData.questionText}
                onChange={(e) => {
                  setFormData({ ...formData, questionText: e.target.value });
                  setQuestionAutocompleteOpen(true);
                  setTitleAutocompleteOpen(false);
                }}
                onFocus={() => {
                  setQuestionAutocompleteOpen(true);
                  setTitleAutocompleteOpen(false);
                }}
                onBlur={() => {
                  setTimeout(() => setQuestionAutocompleteOpen(false), 200);
                }}
                autoComplete="off"
                required
                className="h-14 rounded-2xl text-[17px] bg-foreground/[0.06] border-foreground/[0.14]"
              />
              {questionAutocompleteOpen &&
                customQuestionSuggestions.length > 0 && (
                  <AutocompleteDropdown
                    headerLabel={t("addTracker.autocompleteHeader")}
                    suggestions={customQuestionSuggestions}
                    onPick={handleAutocompletePick}
                    t={t}
                  />
                )}
            </div>

            {/* her answers in words, for links (optional) */}
            <AnswerWordsFields value={words} onChange={setWords} />

            {/* "Yes" is… Good / Bad. Good → the signal is a No day
                (problemWhen "no"); Bad → the signal is a Yes day. */}
            <div>
              <p className="text-[19px] font-semibold">{t("addTracker.yesIs")}</p>
              <div className="seg mt-3 w-full">
                {([["good", "no"], ["bad", "yes"]] as const).map(([key, problemWhen]) => {
                  const on = formData.problemWhen === problemWhen;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, problemWhen })}
                      aria-pressed={on}
                      className={cn("chip h-12 min-w-0 flex-1 text-[17px]", on && "is-on")}
                    >
                      {t(`addTracker.${key}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* When is it time to act, and her plan (the action point). */}
            <RuleChips
              hard={formData.problemWhen === "yes"}
              value={ruleKeyOf(formData)}
              customLabel={t("rules.custom", { n: formData.threshold, count: formData.periodDays })}
              onChange={(_, rule) => setFormData({ ...formData, ...rule })}
              plan={formData.adviceAboveThreshold}
              onPlan={(s) => setFormData({ ...formData, adviceAboveThreshold: s })}
            />

            {/* More settings: the name and the theme. */}
            <div>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="flex items-center gap-1.5 text-base font-semibold text-muted-foreground"
              >
                {t("addTracker.moreSettings")}
                <ChevronDown className={cn("h-5 w-5 transition-transform", moreOpen && "rotate-180")} />
              </button>
              {moreOpen && (
                <div className="mt-4 space-y-5 animate-fade-in">
                  <div className="relative">
                    <Label htmlFor="title">{t("addTracker.fieldTitle")}</Label>
                    <Input
                      id="title"
                      placeholder={formData.questionText.trim().replace(/[?？]+$/, "") || t("addTracker.fieldTitlePh")}
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value });
                        setTitleAutocompleteOpen(true);
                        setQuestionAutocompleteOpen(false);
                      }}
                      onFocus={() => {
                        setTitleAutocompleteOpen(true);
                        setQuestionAutocompleteOpen(false);
                      }}
                      onBlur={() => {
                        setTimeout(() => setTitleAutocompleteOpen(false), 200);
                      }}
                      autoComplete="off"
                      className="mt-1.5 h-12 rounded-xl text-base"
                    />
                    {titleAutocompleteOpen && customTitleSuggestions.length > 0 && (
                      <AutocompleteDropdown
                        headerLabel={t("addTracker.autocompleteHeader")}
                        suggestions={customTitleSuggestions}
                        onPick={handleAutocompletePick}
                        t={t}
                      />
                    )}
                  </div>

                  {/* Theme (cluster): category is derived from it, and
                      correlations use the cluster for softer verdicts. */}
                  <div>
                    <Label htmlFor="cluster">{t("addTracker.fieldTheme")}</Label>
                    <Select
                      value={formData.cluster ?? ""}
                      onValueChange={(value) => {
                        const derivedCategory = CLUSTER_TO_CATEGORY[value] ?? "Curious";
                        setFormData({ ...formData, cluster: value, category: derivedCategory });
                      }}
                    >
                      <SelectTrigger id="cluster" className="mt-1.5 h-12 rounded-xl text-base">
                        <SelectValue placeholder={t("addTracker.themePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {visibleGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {localizeGroupTitle(group.title)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              )}
            </div>

            <div className="flex-1" />
            <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 bg-background/95 backdrop-blur-sm">
              <Button type="submit" disabled={!formData.questionText.trim()} className="w-full h-[54px] rounded-full text-[17px] font-semibold">
                {t("addTracker.add")}
              </Button>
            </div>
          </form>
        )}
        </div>
        {/* end scroll area */}

        {/* Back-to-top button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="absolute bottom-6 right-6 z-20 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform animate-fade-in"
            aria-label={t("addTracker.scrollToTop")}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>

      <DuplicateTrackerDialog
        open={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        existingTracker={duplicateTracker}
        isArchived={duplicateIsArchived}
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={handleCreateAnyway}
        onRestoreFromArchive={async () => {
          if (!duplicateTracker) return;
          const all = await getTrackers();
          const restored = all.map((t) =>
            t.id === duplicateTracker.id ? { ...t, archived: false } : t,
          );
          await saveTrackers(restored);
          setDuplicateDialogOpen(false);
          setPendingTracker(null);
          setDuplicateTracker(null);
          setDuplicateIsArchived(false);
          // Surface the restored tracker so caller can navigate.
          if (onNavigateToTracker) onNavigateToTracker(duplicateTracker);
          onClose();
          toast({
            title: t("today.restoredFromArchive"),
            description: t("today.restoredFromArchiveDesc"),
          });
        }}
      />
    </>,
    document.body,
  );
};
