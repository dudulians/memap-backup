import { useState, useRef, useEffect } from "react";
import { Tracker } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { TEMPLATE_GROUPS } from "@/lib/templateGroups";
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
      Add
    </Button>
  );
};


export const AddTrackerModal = ({
  open,
  onClose,
  onTrackerAdded,
  onNavigateToTracker,
}: AddTrackerModalProps) => {
  const [mode, setMode] = useState<"templates" | "custom">("templates");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTracker, setDuplicateTracker] = useState<Tracker | null>(null);
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

    // If there's a search query, filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return allTemplates.filter(template => 
        template.title.toLowerCase().includes(query) ||
        template.questionText.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query)
      );
    }

    return allTemplates;
  };

  const dropdownTemplates = getAllTemplatesForDropdown();

  // Check for duplicate trackers
  const checkForDuplicate = async (title: string, category: Tracker["category"]): Promise<Tracker | null> => {
    const trackers = await getTrackers();
    const normalizedTitle = title.trim().toLowerCase();
    
    const duplicate = trackers.find(
      t => t.title.trim().toLowerCase() === normalizedTitle && 
           t.category === category &&
           !t.archived
    );
    
    return duplicate || null;
  };

  const createTrackerDirectly = async (newTracker: Tracker) => {
    const trackers = await getTrackers();
    await saveTrackers([...trackers, newTracker]);
    setSearchQuery("");
    setSearchOpen(false);
    
    // Show success toast
    toast({
      title: "Tracker added",
      description: `"${newTracker.title}" has been added to your map`,
    });
    
    onTrackerAdded();
  };

  const handleTemplateSelect = async (template: typeof TEMPLATE_GROUPS[0]["templates"][0]) => {
    // Check for duplicates
    const duplicate = await checkForDuplicate(template.title, template.category);
    
    if (duplicate) {
      // Store the pending tracker and show duplicate dialog
      const newTracker: Tracker = {
        title: template.title,
        questionText: template.questionText,
        category: template.category,
        subcategory: template.subcategory,
        periodDays: template.periodDays,
        threshold: template.threshold,
        problemWhen: template.problemWhen,
        adviceAboveThreshold: template.adviceAboveThreshold,
        answerType: "boolean",
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      
      setPendingTracker(newTracker);
      setDuplicateTracker(duplicate);
      setDuplicateDialogOpen(true);
      return;
    }

    // No duplicate - create directly
    const newTracker: Tracker = {
      title: template.title,
      questionText: template.questionText,
      category: template.category,
      subcategory: template.subcategory,
      periodDays: template.periodDays,
      threshold: template.threshold,
      problemWhen: template.problemWhen,
      adviceAboveThreshold: template.adviceAboveThreshold,
      answerType: "boolean",
      id: uuid(),
      createdAt: new Date().toISOString(),
    };

    await createTrackerDirectly(newTracker);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicates
    const duplicate = await checkForDuplicate(formData.title, formData.category);
    
    if (duplicate) {
      const newTracker: Tracker = {
        ...formData,
        id: uuid(),
        answerType: "boolean",
        createdAt: new Date().toISOString(),
      };
      
      setPendingTracker(newTracker);
      setDuplicateTracker(duplicate);
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
      title: "Tracker added",
      description: `"${newTracker.title}" has been added to your map`,
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

    // If there's a search query, return flat list of matching templates
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const allTemplates = filteredGroups.flatMap(group => 
        group.templates.map(template => ({ ...template, groupTitle: group.title }))
      );
      
      return allTemplates.filter(template => 
        template.title.toLowerCase().includes(query) ||
        template.questionText.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query)
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
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={handleCreateAnyway}
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
          <h2 className="text-lg font-semibold">Add Tracker</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9" aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 relative">

        <Tabs value={mode} onValueChange={(v) => setMode(v as "templates" | "custom")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="templates">Use Template</TabsTrigger>
            <TabsTrigger value="custom">Create Custom</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6 mt-0">
            {/* Theme Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="theme-select">Select a theme</Label>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger id="theme-select" className="w-full">
                  <SelectValue placeholder="Choose a theme" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">All themes</SelectItem>
                  {TEMPLATE_GROUPS.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input with Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="search-templates">Search templates</Label>
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
                  placeholder="Search templates (migraine, sleep, work…)"
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
                <div className="absolute left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {dropdownTemplates.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No templates found. Try different keywords.
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
                                {template.title}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {template.questionText}
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
                              {template.category}
                            </Badge>
                          </button>
                        );
                      })}
                      {dropdownTemplates.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          +{dropdownTemplates.length - 10} more results
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Type to search or scroll through suggestions below
              </p>
            </div>

            {/* Templates Display - Suggested Ideas */}
            <div className="space-y-4">
              <div className="pt-4 mt-4">
                <h3 className="font-semibold text-base mb-1">Suggested ideas</h3>
                <p className="text-sm text-muted-foreground">
                  Browse popular templates by category
                </p>
              </div>
              
              {searchQuery.trim() && filteredTemplates ? (
                // Search Results (Flat List)
                <>
                  <div>
                    <h3 className="font-semibold text-base">Search results</h3>
                    <p className="text-sm text-muted-foreground">
                      {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                  {filteredTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No templates match your search. Try different keywords or switch to "Create Custom" tab.
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
                                <CardTitle className="text-base">{template.title}</CardTitle>
                                <Badge
                                  variant="secondary"
                                  className="text-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                                    color: `hsl(var(--${categoryColor}))`
                                  }}
                                >
                                  {template.category}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                                  {template.questionText}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleTemplateSelect(template); }}
                                  style={{ touchAction: "manipulation" }}
                                  className="flex-shrink-0 h-9 rounded-full shadow-sm gap-1 px-3"
                                  aria-label={`Add ${template.title}`}
                                >
                                  <Plus className="h-4 w-4" />
                                  Add
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
                    <h3 className="font-semibold text-base">{group.title}</h3>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
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
                              <CardTitle className="text-base">{template.title}</CardTitle>
                              <Badge
                                variant="secondary"
                                className="text-xs flex-shrink-0"
                                style={{
                                  backgroundColor: `hsl(var(--${categoryColor}) / 0.1)`,
                                  color: `hsl(var(--${categoryColor}))`
                                }}
                              >
                                {template.category}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                                {template.questionText}
                              </p>
                              <AddTemplateButton
                                label={`Add ${template.title}`}
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
              <h3 className="font-semibold text-base">Create your own tracker</h3>
              <p className="text-sm text-muted-foreground">
                Define a custom question, period, and threshold that matters to you.
              </p>
            </div>
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Morning meditation"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="questionText">Question</Label>
                <Input
                  id="questionText"
                  placeholder="e.g., Did you meditate this morning?"
                  value={formData.questionText}
                  onChange={(e) =>
                    setFormData({ ...formData, questionText: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value as Tracker["category"] })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Emotions">Emotions</SelectItem>
                    <SelectItem value="Body">Body</SelectItem>
                    <SelectItem value="Connections">Connections</SelectItem>
                    <SelectItem value="Voice">Voice</SelectItem>
                    <SelectItem value="Health">Health</SelectItem>
                    <SelectItem value="Curious">Curious</SelectItem>
                    <SelectItem value="Fun">Fun</SelectItem>
                    <SelectItem value="Social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodDays">Track last N days</Label>
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
                  <p className="text-xs text-muted-foreground mt-1">How far back to look</p>
                </div>
                <div>
                  <Label htmlFor="threshold">Significant days to reflect</Label>
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
                  <p className="text-xs text-muted-foreground mt-1">Triggers reflection</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Which answer is a concern?</Label>
                <p className="text-xs text-muted-foreground">
                  The concerning answer will be highlighted in red and counted toward the pattern threshold.
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
                      <p className="text-sm font-medium">Yes is concerning</p>
                      <p className="text-xs text-muted-foreground">Answering Yes counts as a significant day</p>
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
                      <p className="text-sm font-medium">No is concerning</p>
                      <p className="text-xs text-muted-foreground">Answering No counts as a significant day</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="adviceAboveThreshold">
                  Reflection if threshold exceeded
                </Label>
                <Textarea
                  id="adviceAboveThreshold"
                  placeholder="What should you reflect on when the pattern becomes significant?"
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
                Create Custom Tracker
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
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>

      <DuplicateTrackerDialog
        open={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
        existingTracker={duplicateTracker}
        onOpenExisting={handleOpenExisting}
        onCreateAnyway={handleCreateAnyway}
      />
    </>
  );
};
