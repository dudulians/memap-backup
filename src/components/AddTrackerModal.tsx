import { useState, useRef, useEffect } from "react";
import { Tracker } from "@/types/tracker";
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
} from "@/lib/trackerLocalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getCategoryColor } from "@/lib/categoryHelpers";
import { Search, Plus, X, ArrowUp } from "lucide-react";
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

/**
 * Dedicated Add button that fires from whichever of pointerup/click
 * arrives first. iOS Safari is flaky about synthesizing `click` from
 * touchend in some layouts — listening to pointerup makes the tap
 * land reliably, and the ref guard prevents a second fire from the
 * mouse/keyboard `click` event on desktop.
 */
const AddTemplateButton = ({ label, onAdd }: { label: string; onAdd: () => void }) => {
  const { t } = useTranslation();
  const firedRef = useRef(false);
  const resetSoon = () => {
    // Reset after the current event loop so both pointerup and click
    // see the latched value, but a subsequent tap starts fresh.
    setTimeout(() => { firedRef.current = false; }, 0);
  };
  const fire = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (firedRef.current) return;
    firedRef.current = true;
    onAdd();
    resetSoon();
  };
  return (
    <Button
      type="button"
      size="sm"
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
    periodDays: 30,
    threshold: 10,
    problemWhen: "yes" as "yes" | "no",
    adviceAboveThreshold: "",
  });
  const [periodDaysRaw, setPeriodDaysRaw] = useState("30");
  const [thresholdRaw, setThresholdRaw] = useState("10");

  // Get all templates for autocomplete dropdown
  const getAllTemplatesForDropdown = () => {
    let filteredGroups = TEMPLATE_GROUPS;

    // Filter by theme
    if (selectedTheme !== "all") {
      filteredGroups = TEMPLATE_GROUPS.filter(group => group.id === selectedTheme);
    }

    // Flatten to all templates with group info
    const allTemplates = filteredGroups.flatMap(group => 
      group.templates.map(template => ({ ...template, groupTitle: group.title }))
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

  // Check for duplicate trackers (active OR archived). Returns
  // tracker + isArchived so the dialog can offer "Restore from
  // archive" instead of "Open existing" when the match is archived.
  const checkForDuplicate = async (
    title: string,
    category: Tracker["category"],
  ): Promise<{ tracker: Tracker; isArchived: boolean } | null> => {
    const trackers = await getTrackers();
    const normalizedTitle = title.trim().toLowerCase();

    const matches = trackers.filter(
      (t) =>
        t.title.trim().toLowerCase() === normalizedTitle &&
        t.category === category,
    );
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

    // Check for duplicates (match against the localized title since that's
    // what the user sees and what new trackers get stored as).
    const dup = await checkForDuplicate(localizedTitle, template.category);

    if (dup) {
      // Store the pending tracker and show duplicate dialog
      const newTracker: Tracker = {
        title: localizedTitle,
        questionText: localizedQuestion,
        category: template.category,
        subcategory: template.subcategory,
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
    let filteredGroups = TEMPLATE_GROUPS;

    // Filter by theme
    if (selectedTheme !== "all") {
      filteredGroups = TEMPLATE_GROUPS.filter(group => group.id === selectedTheme);
    }

    // If there's a search query, return flat list of matching templates.
    // Match against both English (stored) and Russian (displayed) strings so
    // Russian-speaking users can search using the terms they see.
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const allTemplates = filteredGroups.flatMap(group =>
        group.templates.map(template => ({ ...template, groupTitle: group.title }))
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
    ? TEMPLATE_GROUPS
    : TEMPLATE_GROUPS.filter(group => group.id === selectedTheme);

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
          maxHeight: "92vh",
          height: "92vh",
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-6 pb-4 relative">

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
                  {TEMPLATE_GROUPS.map(group => (
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
                            onClick={() => {
                              handleTemplateSelect(template);
                              setSearchOpen(false);
                            }}
                            className="w-full flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {localizeTrackerTitle(template.title)}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {localizeTrackerQuestion(template.questionText)}
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
                              {t(`categories.${template.category}`)}
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
                            className="hover:bg-accent/30 transition-colors"
                            style={{ borderLeftColor: `hsl(var(--${categoryColor}))`, borderLeftWidth: '3px' }}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base">{localizeTrackerTitle(template.title)}</CardTitle>
                                <Badge
                                  variant="secondary"
                                  className="text-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                                    color: `hsl(var(--${categoryColor}))`
                                  }}
                                >
                                  {t(`categories.${template.category}`)}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                                  {localizeTrackerQuestion(template.questionText)}
                                </p>
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
                // Grouped Display
                <div className="space-y-6">
              {filteredGroups.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-base">{localizeGroupTitle(group.title)}</h3>
                    <p className="text-sm text-muted-foreground">{localizeGroupDescription(group.description)}</p>
                  </div>
                  <div className="space-y-2">
                    {group.templates.map((template) => {
                      const categoryColor = getCategoryColor(template.category);
                      return (
                        <Card
                          key={template.id}
                          className="hover:bg-accent/30 transition-colors"
                          style={{ borderLeftColor: `hsl(var(--${categoryColor}))`, borderLeftWidth: '3px' }}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">{localizeTrackerTitle(template.title)}</CardTitle>
                              <Badge
                                variant="secondary"
                                className="text-xs flex-shrink-0"
                                style={{
                                  backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                                  color: `hsl(var(--${categoryColor}))`
                                }}
                              >
                                {t(`categories.${template.category}`)}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                                {localizeTrackerQuestion(template.questionText)}
                              </p>
                              <AddTemplateButton
                                label={t("addTracker.addAria", { title: localizeTrackerTitle(template.title) })}
                                onAdd={() => handleTemplateSelect(template)}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                      })}
                    </div>
                  </div>
                ))}
                </div>
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
              <div>
                <Label htmlFor="title">{t("addTracker.fieldTitle")}</Label>
                <Input
                  id="title"
                  placeholder={t("addTracker.fieldTitlePh")}
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="questionText">{t("addTracker.fieldQuestion")}</Label>
                <Input
                  id="questionText"
                  placeholder={t("addTracker.fieldQuestionPh")}
                  value={formData.questionText}
                  onChange={(e) =>
                    setFormData({ ...formData, questionText: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">{t("addTracker.fieldCategory")}</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value as Tracker["category"] })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Emotions">{t("categories.Emotions")}</SelectItem>
                    <SelectItem value="Body">{t("categories.Body")}</SelectItem>
                    <SelectItem value="Connections">{t("categories.Connections")}</SelectItem>
                    <SelectItem value="Voice">{t("categories.Voice")}</SelectItem>
                    <SelectItem value="Health">{t("categories.Health")}</SelectItem>
                    <SelectItem value="Curious">{t("categories.Curious")}</SelectItem>
                    <SelectItem value="Fun">{t("categories.Fun")}</SelectItem>
                    <SelectItem value="Social">{t("categories.Social")}</SelectItem>
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

              <div className="space-y-2">
                <Label>{t("addTracker.fieldConcern")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("addTracker.fieldConcernDesc")}
                </p>
                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors hover:bg-muted/30"
                    style={formData.problemWhen === "yes" ? { borderColor: "hsl(var(--strong))", background: "hsl(var(--strong) / 0.05)" } : {}}>
                    <input
                      type="radio"
                      name="problemWhen-new"
                      value="yes"
                      checked={formData.problemWhen === "yes"}
                      onChange={() => setFormData({ ...formData, problemWhen: "yes" })}
                      className="h-4 w-4 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{t("addTracker.yesConcerning")}</p>
                      <p className="text-xs text-muted-foreground">{t("addTracker.yesConcerningDesc")}</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors hover:bg-muted/30"
                    style={formData.problemWhen === "no" ? { borderColor: "hsl(var(--strong))", background: "hsl(var(--strong) / 0.05)" } : {}}>
                    <input
                      type="radio"
                      name="problemWhen-new"
                      value="no"
                      checked={formData.problemWhen === "no"}
                      onChange={() => setFormData({ ...formData, problemWhen: "no" })}
                      className="h-4 w-4 mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{t("addTracker.noConcerning")}</p>
                      <p className="text-xs text-muted-foreground">{t("addTracker.noConcerningDesc")}</p>
                    </div>
                  </label>
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

              <Button type="submit" className="w-full sticky bottom-0 shadow-lg">
                {t("addTracker.createCustomBtn")}
              </Button>
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
