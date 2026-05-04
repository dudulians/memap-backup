import { useState, useRef, useEffect } from "react";
import { Tracker, ProblemWhen } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { TEMPLATE_GROUPS } from "@/lib/templateGroups";
import {
  localizeTrackerTitle,
  localizeTrackerQuestion,
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
  localizeGroupTitle,
  localizeGroupDescription,
  localizeTrackerTheme,
} from "@/lib/trackerLocalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getCategoryColor } from "@/lib/categoryHelpers";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import {
  Search,
  Plus,
  X,
  Check,
  ArrowUp,
  // Cluster icons — replace the emoji that came from lifeStreams.ts.
  // Emoji rendered inconsistently across iOS / Android / web (some
  // fonts box-drew, some had off-baseline alignment, the family
  // composite ⚭ glyph collapsed on certain installs). Lucide is
  // already the icon system everywhere else in the app, so this
  // unifies look-and-feel.
  Heart,
  Users,
  HeartPulse,
  Wine,
  Sun,
  Compass,
  Globe,
  Building,
  Folder,
  ChevronDown,
} from "lucide-react";
import { DuplicateTrackerDialog } from "./DuplicateTrackerDialog";
import { toast } from "@/hooks/use-toast";
import { uuid } from "@/lib/uuid";
import { useTranslation } from "react-i18next";

interface AddTrackerModalProps {
  open: boolean;
  onClose: () => void;
  onTrackerAdded: () => void;
  onNavigateToTracker?: (tracker: Tracker) => void;
}

// Cluster id → Lucide icon component. Single source of truth for the
// visual identity of each cluster in this modal. If a future cluster
// id isn't here, falls back to a generic Folder icon.
const CLUSTER_ICONS: Record<string, typeof Heart> = {
  partner: Heart,
  parenting: Users,
  health: HeartPulse,
  habits: Wine,
  state: Sun,
  "big-decisions": Compass,
  "external-events": Building,
  expat: Globe,
};

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
 * Dedicated Add button that fires from whichever of pointerup/click
 * arrives first. iOS Safari is flaky about synthesizing `click` from
 * touchend in some layouts — listening to pointerup makes the tap
 * land reliably, and the ref guard prevents a second fire from the
 * mouse/keyboard `click` event on desktop.
 *
 * Tap-vs-scroll guard (1.7+): record the pointer-down position and
 * bail if the finger moved more than TAP_SLOP_PX between down and
 * up. Without this, the user reported "I scrolled the template list
 * and accidentally added 5 templates" — `onPointerUp` fires
 * regardless of movement, unlike native `onClick` which the browser
 * suppresses after a scroll-distance touchmove. 10px matches
 * iOS HIG / Material Design tap-slop conventions.
 */
const TAP_SLOP_PX = 10;

const AddTemplateButton = ({ label, onAdd }: { label: string; onAdd: () => void }) => {
  const { t } = useTranslation();
  const firedRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const resetSoon = () => {
    // Reset after the current event loop so both pointerup and click
    // see the latched value, but a subsequent tap starts fresh.
    setTimeout(() => {
      firedRef.current = false;
      startPosRef.current = null;
    }, 0);
  };
  const handleDown = (e: React.PointerEvent) => {
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const fire = (e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (firedRef.current) return;

    // Tap-vs-scroll: if the finger drifted more than TAP_SLOP_PX
    // between down and up, this is a scroll gesture — bail. Only
    // applies to events that have client coords (pointer / mouse).
    const start = startPosRef.current;
    if (start && "clientX" in e) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > TAP_SLOP_PX) {
        startPosRef.current = null;
        return;
      }
    }

    firedRef.current = true;
    onAdd();
    resetSoon();
  };
  return (
    <Button
      type="button"
      size="sm"
      onPointerDown={handleDown}
      onPointerUp={fire}
      onClick={fire}
      style={{ touchAction: "manipulation" }}
      className="flex-shrink-0 h-9 rounded-full shadow-sm gap-1 px-3"
      aria-label={label}
    >
      <Plus className="h-4 w-4" />
      {t("addTracker.add")}
    </Button>
  );
};

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
                {localizeTrackerQuestion(template.questionText)}
              </p>
              <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                {localizeTrackerTitle(template.title)}
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
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
    threshold: 10,
    problemWhen: "yes" as "yes" | "no",
    adviceAboveThreshold: "",
  });
  const [periodDaysRaw, setPeriodDaysRaw] = useState("30");
  const [thresholdRaw, setThresholdRaw] = useState("10");
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

  // Sensitive templates (intimacy, libido, ex). Hidden by default to
  // keep the catalog safe-for-work; user opts in via Settings →
  // "Show sensitive topics".
  const filterSensitive = <T extends { sensitive?: boolean }>(arr: T[]): T[] => {
    if (interviewAnswers.showSensitive) return arr;
    return arr.filter((t) => !t.sensitive);
  };

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
    setSearchOpen(false);
    
    // Show success toast
    toast({
      title: t("today.trackerAdded"),
      description: t("today.trackerAddedDesc", { title: newTracker.title }),
    });

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
      // Store the pending tracker and show duplicate dialog
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

      setPendingTracker(newTracker);
      setDuplicateTracker(dup.tracker);
      setDuplicateIsArchived(dup.isArchived);
      setDuplicateDialogOpen(true);
      return;
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
    setPeriodDaysRaw(String(template.periodDays));
    setThresholdRaw(String(template.threshold));
    setTitleAutocompleteOpen(false);
    setQuestionAutocompleteOpen(false);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicates
    const dup = await checkForDuplicate(formData.title, formData.category);

    if (dup) {
      const newTracker: Tracker = {
        ...formData,
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
      ...formData,
      id: uuid(),
      answerType: "boolean",
      createdAt: new Date().toISOString(),
    };

    const trackers = await getTrackers();
    await saveTrackers([...trackers, newTracker]);
    
    // Show success toast
    toast({
      title: t("today.trackerAdded"),
      description: t("today.trackerAddedDesc", { title: newTracker.title }),
    });

    setFormData({
      title: "",
      questionText: "",
      category: "Curious",
      subcategory: undefined,
      cluster: undefined,
      periodDays: 30,
      threshold: 10,
      problemWhen: "yes",
      adviceAboveThreshold: "",
    });
    setPeriodDaysRaw("30");
    setThresholdRaw("10");
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

  return (
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
        {/* Drag handle + header */}
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerEnd}
          onPointerCancel={handleHandlePointerEnd}
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 mb-2" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 border-b border-border/40 sticky top-0 bg-background/95 backdrop-blur-md z-10">
          <h2 className="text-lg font-semibold">{t("addTracker.title")}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9" aria-label={t("common.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Extra top padding (pt-6) so the Шаблон/Свой tabs sit
            comfortably below the sticky header. Was pt-4 — visually
            felt tight, the header's border looked like it was clipping
            the tab pills. */}
        {/* `overflow-x-hidden` is critical — without it, anything in the
            scroll body that overflows horizontally (long titles in
            cards, accordion triggers with not-quite-shrunk content,
            etc.) lets the user pan the entire modal sideways and
            half of the layout slides off-screen. The user reported
            exactly this after the 1.6 accordion redesign. With
            overflow-x-hidden any internal overflow gets quietly
            clipped instead of dragging the whole modal sideways. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-6 pb-4 relative">

        <Tabs value={mode} onValueChange={(v) => setMode(v as "templates" | "custom")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="templates">{t("addTracker.useTemplate")}</TabsTrigger>
            <TabsTrigger value="custom">{t("addTracker.createCustom")}</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6 mt-0">
            {/* Theme Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="theme-select">{t("addTracker.selectTheme")}</Label>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger id="theme-select" className="w-full">
                  <SelectValue placeholder={t("addTracker.chooseTheme")} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">{t("addTracker.allThemes")}</SelectItem>
                  {visibleGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {localizeGroupTitle(group.title)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input with Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="search-templates">{t("addTracker.searchTemplates")}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  id="search-templates"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={t("addTracker.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    // Delay closing to allow click on dropdown items
                    setTimeout(() => setSearchOpen(false), 200);
                  }}
                  className="pl-10"
                />
              </div>
              
              {/* Dropdown results */}
              {searchOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {dropdownTemplates.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      {t("addTracker.noTemplatesFound")}
                    </div>
                  ) : (
                    <div className="py-1">
                      {dropdownTemplates.slice(0, 10).map((template) => {
                        const categoryColor = getCategoryColor(template.category);
                        return (
                          <button
                            key={template.id}
                            type="button"
                            // Tap suggestion → preview/edit (switch to
                            // Custom tab pre-filled), not instant-add.
                            // 1.7+ matches the same behavior as
                            // accordion card body taps.
                            onClick={() => {
                              handleAutocompletePick(template);
                              setMode("custom");
                              setSearchOpen(false);
                              setSearchQuery("");
                            }}
                            className="w-full flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm leading-snug line-clamp-2">
                                {localizeTrackerQuestion(template.questionText)}
                              </p>
                              <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                                {localizeTrackerTitle(template.title)}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-xs flex-shrink-0"
                              style={{ 
                                backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                                color: `hsl(var(--${categoryColor}))`
                              }}
                            >
                              {localizeTrackerTheme(template)}
                            </Badge>
                          </button>
                        );
                      })}
                      {dropdownTemplates.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          {t("addTracker.moreResults", { count: dropdownTemplates.length - 10 })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t("addTracker.searchTypeHint")}
              </p>
            </div>

            {/* Templates Display - Suggested Ideas */}
            <div className="space-y-4">
              <div className="pt-4 mt-4">
                <h3 className="font-semibold text-base mb-1">{t("addTracker.suggestedIdeas")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("addTracker.suggestedIdeasDesc")}
                </p>
              </div>
              
              {searchQuery.trim() && filteredTemplates ? (
                // Search Results (Flat List)
                <>
                  <div>
                    <h3 className="font-semibold text-base">{t("addTracker.searchResults")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {filteredTemplates.length === 1
                        ? t("addTracker.templatesFoundOne")
                        : t("addTracker.templatesFoundMany", { count: filteredTemplates.length })}
                    </p>
                  </div>
                  {filteredTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {t("addTracker.noMatchHint")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredTemplates.map((template) => {
                        const categoryColor = getCategoryColor(template.category);
                        return (
                          <Card
                            key={template.id}
                            // Tap on card body → preview/edit (switch
                            // to Custom tab pre-filled). Mirrors the
                            // accordion behavior: body = preview,
                            // "+" button = instant-add.
                            onClick={() => {
                              handleAutocompletePick(template);
                              setMode("custom");
                              setSearchQuery("");
                            }}
                            className="hover:bg-accent/30 transition-colors overflow-hidden cursor-pointer"
                            style={{ borderLeftColor: `hsl(var(--${categoryColor}))`, borderLeftWidth: '3px' }}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-2">
                                {/* Question prominent — same hierarchy
                                    as Today and TrackerDetails */}
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-medium leading-snug break-words">
                                    {localizeTrackerQuestion(template.questionText)}
                                  </CardTitle>
                                  <p className="text-[11px] text-muted-foreground/80 truncate mt-1">
                                    {localizeTrackerTitle(template.title)}
                                  </p>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="text-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                                    color: `hsl(var(--${categoryColor}))`
                                  }}
                                >
                                  {localizeTrackerTheme(template)}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex items-center justify-end gap-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleTemplateSelect(template); }}
                                  style={{ touchAction: "manipulation" }}
                                  className="flex-shrink-0 h-9 rounded-full shadow-sm gap-1 px-3"
                                  aria-label={t("addTracker.addAria", { title: localizeTrackerTitle(template.title) })}
                                >
                                  <Plus className="h-4 w-4" />
                                  {t("addTracker.add")}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                // Accordion Display — clusters collapsed by default
                // (except the first one) so the user sees the full
                // catalog structure at a glance and only expands what
                // interests them. Was a flat dump of every group +
                // every template — overwhelming once the library
                // grows beyond a few dozen.
                //
                // The first cluster is open by default so the user
                // immediately sees REAL templates (not just a list
                // of section headers), which proves "yes there's
                // content inside, tap to explore the rest."
                //
                // Cluster icons come from LIFE_STREAMS (the canonical
                // source); we look them up by group.id to keep the
                // visual identity consistent with rest of the app.
                <Accordion
                  type="multiple"
                  defaultValue={[]}
                  className="space-y-2"
                >
                  {filteredGroups.map((group) => {
                    const ClusterIcon = CLUSTER_ICONS[group.id] ?? Folder;
                    // Stream lookup gives us cluster.color for tinting
                    // the Lucide icon — keeps each cluster visually
                    // distinct without falling back to emoji noise.
                    const stream = LIFE_STREAMS.find((s) => s.id === group.id);
                    const clusterColor = stream?.color ?? "muted";
                    const visibleTemplates = filterSensitive(group.templates);
                    const featured = visibleTemplates.filter((t) => t.featured);
                    const rest = visibleTemplates.filter((t) => !t.featured);
                    // If a cluster has no featured templates marked
                    // (defensive — shouldn't happen for the 7 canonical
                    // clusters, but matters for any custom groups added
                    // later), fall back to "show all" so we never
                    // collapse into emptiness.
                    const isExpanded = expandedFull[group.id] === true;
                    const startList = featured.length === 0
                      ? visibleTemplates
                      : (isExpanded ? visibleTemplates : featured);
                    const moreCount = visibleTemplates.length - featured.length;
                    const showMoreButton =
                      featured.length > 0 && !isExpanded && moreCount > 0;
                    return (
                      <AccordionItem
                        key={group.id}
                        value={group.id}
                        className="border border-border/40 rounded-2xl bg-card/30 overflow-hidden"
                      >
                        <AccordionTrigger className="hover:no-underline py-3 px-4 gap-2">
                          {/* Header row: icon + title/desc + count badge.
                              Layout reworked to fix the v1.7.0 bug where
                              the count badge floated mid-row and text
                              clipped mid-word. min-w-0 + truncate on the
                              text column lets it shrink cleanly; the
                              badge is its own flex-shrink-0 column on
                              the right so it never collides. */}
                          <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                            <span
                              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `hsl(var(--${clusterColor}) / 0.12)` }}
                            >
                              <ClusterIcon
                                className="h-[18px] w-[18px]"
                                style={{ color: `hsl(var(--${clusterColor}))` }}
                                strokeWidth={2}
                              />
                            </span>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm leading-snug break-words">
                                {localizeGroupTitle(group.title)}
                              </h3>
                              {/* line-clamp-2 lets the description wrap
                                  to 2 lines instead of truncating mid-
                                  word. break-words handles long single
                                  words gracefully. Was: `truncate` —
                                  fixed in 1.7.0 after user reported
                                  cluster descriptions being cut as
                                  "просто кажется..." */}
                              <p className="text-xs text-muted-foreground leading-snug line-clamp-2 break-words mt-0.5">
                                {localizeGroupDescription(group.description)}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] flex-shrink-0 bg-muted/60 text-muted-foreground font-medium px-2 h-5 rounded-full"
                            >
                              {visibleTemplates.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-3 px-4">
                          <div className="space-y-2">
                            {startList.map((template) => {
                              const categoryColor = getCategoryColor(template.category);
                              return (
                                <Card
                                  key={template.id}
                                  // Tap on card body → opens "preview /
                                  // edit before add" — switches to the
                                  // Custom tab pre-filled with this
                                  // template's data so user can review
                                  // all fields (period, threshold,
                                  // polarity, advice) before adding.
                                  // The "+" button on the right keeps
                                  // the fast-path: instant add. Built
                                  // in 1.7 after user asked for
                                  // template details before commit.
                                  onClick={() => {
                                    handleAutocompletePick(template);
                                    setMode("custom");
                                  }}
                                  className="hover:bg-accent/30 transition-colors overflow-hidden cursor-pointer"
                                  style={{ borderLeftColor: `hsl(var(--${categoryColor}))`, borderLeftWidth: "3px" }}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        {/* Question prominent, title
                                            secondary — matches the
                                            hierarchy used on Today /
                                            TrackerDetails / Calendar
                                            editor (1.7+). User scans
                                            the question to know what
                                            she'd answer; title is just
                                            the short ID under it. */}
                                        <p className="font-medium text-sm leading-snug line-clamp-2 break-words">
                                          {localizeTrackerQuestion(template.questionText)}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground/80 leading-snug truncate mt-1">
                                          {localizeTrackerTitle(template.title)}
                                        </p>
                                      </div>
                                      <AddTemplateButton
                                        label={t("addTracker.addAria", { title: localizeTrackerTitle(template.title) })}
                                        onAdd={() => handleTemplateSelect(template)}
                                      />
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                            {showMoreButton && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedFull((prev) => ({ ...prev, [group.id]: true }))
                                }
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 text-xs font-medium text-primary transition-colors"
                              >
                                {t("addTracker.showAllInCluster", { count: moreCount })}
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </TabsContent>

          {/* Custom Tracker Tab */}
          <TabsContent value="custom" className="space-y-4 mt-0">
            <div className="space-y-1">
              <h3 className="font-semibold text-base">{t("addTracker.customHeader")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("addTracker.customDesc")}
              </p>
            </div>
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              {/* Question is the PRIMARY field of the custom form
                  (1.7+). Question is what the user actually answers
                  daily, what shows on Today/TrackerDetails as the
                  visual anchor — so it should be where creation
                  flow leads. Title is secondary, asked second.
                  Both fields support library autocomplete, so user
                  can pick a matching template from either side. */}
              <div className="relative">
                <Label htmlFor="questionText">{t("addTracker.fieldQuestion")}</Label>
                <Input
                  id="questionText"
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

              {/* Title — short label for charts, correlations, lists.
                  Also has autocomplete so the user can lock onto a
                  template by typing the title-form. Less prominent
                  than the question field above. */}
              <div className="relative">
                <Label htmlFor="title">{t("addTracker.fieldTitle")}</Label>
                <Input
                  id="title"
                  placeholder={t("addTracker.fieldTitlePh")}
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
                  required
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

              {/* Theme picker — replaces the old "Category" dropdown
                  in 1.7+. Reasoning: the underlying Tracker.category
                  enum (Emotions/Body/Connections/...) is structural
                  metadata for color/grouping, not something the user
                  thinks about. They DO think about "where in my
                  life is this question" — partner, parenting, work,
                  habits. So we ask for THEME (cluster), and derive
                  category from it via CLUSTER_TO_CATEGORY map.
                  Bonus: storing the cluster on the tracker lets
                  correlations.ts give a softer "expected" verdict
                  for custom × library pairs in the same cluster. */}
              <div>
                <Label htmlFor="cluster">{t("addTracker.fieldTheme")}</Label>
                <Select
                  value={formData.cluster ?? ""}
                  onValueChange={(value) => {
                    const derivedCategory = CLUSTER_TO_CATEGORY[value] ?? "Curious";
                    setFormData({ ...formData, cluster: value, category: derivedCategory });
                  }}
                >
                  <SelectTrigger id="cluster">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodDays">{t("addTracker.fieldPeriod")}</Label>
                  <Input
                    id="periodDays"
                    type="number"
                    placeholder="30"
                    value={periodDaysRaw}
                    onChange={(e) => {
                      setPeriodDaysRaw(e.target.value);
                      const n = parseInt(e.target.value);
                      if (!isNaN(n) && n >= 1) setFormData({ ...formData, periodDays: n });
                    }}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("addTracker.fieldPeriodHelp")}</p>
                </div>
                <div>
                  <Label htmlFor="threshold">{t("addTracker.fieldThreshold")}</Label>
                  <Input
                    id="threshold"
                    type="number"
                    placeholder="10"
                    value={thresholdRaw}
                    onChange={(e) => {
                      setThresholdRaw(e.target.value);
                      const n = parseInt(e.target.value);
                      if (!isNaN(n) && n >= 1) setFormData({ ...formData, threshold: n });
                    }}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("addTracker.fieldThresholdHelp")}</p>
                </div>
              </div>

              {/* Polarity toggle — visual two-button control. The
                  selected button is GREEN (good answer); the other
                  is RED (the signal answer). Tap either to swap.
                  Cleaner than radio + descriptions; no "сигнал когда"
                  jargon, just colour-coded answer choice.
                  Wiring inversion: tapping "Да" (= Yes is good)
                  sets problemWhen="no" since the SIGNAL fires on
                  the No answer. Vice versa for "Нет". */}
              <div className="space-y-2">
                <Label>{t("addTracker.fieldConcern")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("addTracker.fieldConcernDesc")}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {(["yes", "no"] as const).map((answerKey) => {
                    const isGood =
                      (answerKey === "yes" && formData.problemWhen === "no") ||
                      (answerKey === "no" && formData.problemWhen === "yes");
                    return (
                      <button
                        key={answerKey}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            // "Yes is good" → signal on No → problemWhen="no"
                            // "No is good" → signal on Yes → problemWhen="yes"
                            problemWhen: answerKey === "yes" ? "no" : "yes",
                          })
                        }
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium transition-all"
                        style={
                          isGood
                            ? {
                                borderColor: "hsl(var(--balanced))",
                                background: "hsl(var(--balanced) / 0.12)",
                                color: "hsl(var(--balanced))",
                              }
                            : {
                                borderColor: "hsl(var(--strong) / 0.4)",
                                background: "hsl(var(--strong) / 0.06)",
                                color: "hsl(var(--strong))",
                              }
                        }
                      >
                        {isGood ? (
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        ) : (
                          <X className="h-4 w-4" strokeWidth={2.5} />
                        )}
                        {answerKey === "yes" ? t("common.yes") : t("common.no")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="adviceAboveThreshold">
                  {t("addTracker.fieldAdvice")}
                </Label>
                <Textarea
                  id="adviceAboveThreshold"
                  placeholder={t("addTracker.fieldAdvicePh")}
                  value={formData.adviceAboveThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adviceAboveThreshold: e.target.value,
                    })
                  }
                  required
                  rows={3}
                />
              </div>

              {/* Sticky action row — primary "Добавить", secondary
                  "Отмена". Both pinned to the bottom of the form
                  so the user can submit without scrolling further.
                  "Добавить" wording is universal: works whether
                  the form was filled by hand OR pre-populated from
                  a library template tap (1.7+ "preview before add"
                  flow). Was: "Создать свой вопрос" — misleading
                  when arriving from a template preview. */}
              <div className="sticky bottom-0 -mx-1 px-1 pt-3 pb-1 bg-background/95 backdrop-blur-sm flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" className="flex-[2] shadow-lg">
                  {t("addTracker.add")}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
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
    </>
  );
};
