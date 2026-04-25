import { useState, useEffect } from "react";
import { Tracker } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, MoreVertical, Archive, Trash2, RotateCcw, Settings, GripVertical } from "lucide-react";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
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
import { AddTrackerModal } from "./AddTrackerModal";
import { TrackerDetails } from "./TrackerDetails";
import { TrackerSettingsModal } from "./TrackerSettingsModal";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { localizeTrackerTitle, localizeTrackerQuestion } from "@/lib/trackerLocalize";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

export const TrackersTab = () => {
  const { toast } = useToast();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackerToDelete, setTrackerToDelete] = useState<Tracker | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [trackerToEdit, setTrackerToEdit] = useState<Tracker | null>(null);
  const [trackerToNavigate, setTrackerToNavigate] = useState<Tracker | null>(null);

  useEffect(() => {
    loadTrackers();
  }, []);

  useEffect(() => {
    if (trackerToNavigate) {
      setSelectedTracker(trackerToNavigate);
      setTrackerToNavigate(null);
    }
  }, [trackerToNavigate]);

  const loadTrackers = async () => {
    const data = await getTrackers();
    // Sort by sortIndex if it exists, otherwise by createdAt
    const sortedTrackers = [...data].sort((a, b) => {
      if (a.sortIndex !== undefined && b.sortIndex !== undefined) {
        return a.sortIndex - b.sortIndex;
      }
      if (a.sortIndex !== undefined) return -1;
      if (b.sortIndex !== undefined) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    setTrackers(sortedTrackers);
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
      const activeTrackers = trackers.filter(t => !t.archived);
      const oldIndex = activeTrackers.findIndex((t) => t.id === active.id);
      const newIndex = activeTrackers.findIndex((t) => t.id === over.id);

      const reorderedActive = arrayMove(activeTrackers, oldIndex, newIndex);
      
      // Update sortIndex for reordered active trackers
      const activeWithIndex = reorderedActive.map((t, index) => ({
        ...t,
        sortIndex: index,
      }));

      // Keep archived trackers unchanged
      const archivedTrackers = trackers.filter(t => t.archived);
      const allTrackers = [...activeWithIndex, ...archivedTrackers];

      setTrackers(allTrackers);
      await saveTrackers(allTrackers);
    }
  };

  const handleArchiveTracker = async (tracker: Tracker) => {
    const updatedTrackers = trackers.map(t =>
      t.id === tracker.id ? { ...t, archived: !t.archived } : t
    );
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
  };

  const handleDeleteTracker = async () => {
    if (!trackerToDelete) return;
    const deleted = trackerToDelete;
    const previousTrackers = trackers;
    const updatedTrackers = trackers.filter(t => t.id !== deleted.id);
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
    setDeleteDialogOpen(false);
    setTrackerToDelete(null);

    toast({
      title: "Tracker deleted",
      description: `"${deleted.title}" was removed.`,
      action: (
        <ToastAction
          altText="Undo"
          onClick={async () => {
            await saveTrackers(previousTrackers);
            setTrackers(previousTrackers);
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const handleSaveTrackerSettings = async (updatedTracker: Tracker) => {
    const updatedTrackers = trackers.map(t =>
      t.id === updatedTracker.id ? updatedTracker : t
    );
    await saveTrackers(updatedTrackers);
    setTrackers(updatedTrackers);
  };

  const activeTrackers = trackers.filter(t => !t.archived);
  const archivedTrackers = trackers.filter(t => t.archived);

  if (selectedTracker) {
    return (
      <TrackerDetails
        tracker={selectedTracker}
        onBack={() => setSelectedTracker(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (activeTrackers.length === 0 && archivedTrackers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-6">
        <div className="space-y-2">
          <p className="text-2xl font-medium">No trackers yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Add a tracker to start recording daily patterns in your life.
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="rounded-full px-6"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--emotions)), hsl(var(--connections)))'
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Your First Tracker
        </Button>

        <AddTrackerModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onTrackerAdded={() => {
            // Keep the modal open so the user can add multiple trackers.
            loadTrackers();
          }}
          onNavigateToTracker={(tracker) => {
            setTrackerToNavigate(tracker);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <p className="text-lg font-medium tracking-wide">Your Trackers</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTrackers.length} active {activeTrackers.length === 1 ? 'tracker' : 'trackers'}
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          size="sm"
          className="rounded-full"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--curious)), hsl(var(--fun)))'
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>

      {/* Active Tracker Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeTrackers.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {activeTrackers.map((tracker) => (
              <SortableTrackerCard
                key={tracker.id}
                tracker={tracker}
                onSelect={setSelectedTracker}
                onArchive={handleArchiveTracker}
                onDelete={(t) => {
                  setTrackerToDelete(t);
                  setDeleteDialogOpen(true);
                }}
                onEdit={(t) => {
                  setTrackerToEdit(t);
                  setSettingsModalOpen(true);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Archived Trackers Section */}
      {archivedTrackers.length > 0 && (
        <div className="space-y-3 pt-6 mt-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <p className="text-sm font-medium text-muted-foreground">Paused (data kept)</p>
              <p className="text-xs text-muted-foreground">
                {archivedTrackers.length} {archivedTrackers.length === 1 ? 'tracker' : 'trackers'}
              </p>
            </div>
            <Button variant="ghost" size="sm">
              {showArchived ? 'Hide' : 'Show'}
            </Button>
          </button>

          {showArchived && (
            <div className="space-y-2">
              {archivedTrackers.map((tracker) => {
                const categoryColor = getCategoryColor(tracker.category);
                const Icon = getTrackerIcon(tracker.title, tracker.category);

                return (
                  <Card
                    key={tracker.id}
                    className="card-premium opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start gap-3">
                      <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
            >
              <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{localizeTrackerTitle(tracker.title)}</h3>
                        <p className="text-xs text-muted-foreground">{tracker.category}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveTracker(tracker)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AddTrackerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onTrackerAdded={() => {
          setModalOpen(false);
          loadTrackers();
        }}
        onNavigateToTracker={(tracker) => {
          setTrackerToNavigate(tracker);
        }}
      />

      <TrackerSettingsModal
        open={settingsModalOpen}
        onClose={() => {
          setSettingsModalOpen(false);
          setTrackerToEdit(null);
        }}
        tracker={trackerToEdit}
        onSave={handleSaveTrackerSettings}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{trackerToDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tracker and all its data. If you just want to stop tracking but keep the history, use <span className="font-medium">Pause</span> instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTracker} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface SortableTrackerCardProps {
  tracker: Tracker;
  onSelect: (tracker: Tracker) => void;
  onArchive: (tracker: Tracker) => void;
  onDelete: (tracker: Tracker) => void;
  onEdit: (tracker: Tracker) => void;
}

const SortableTrackerCard = ({
  tracker,
  onSelect,
  onArchive,
  onDelete,
  onEdit,
}: SortableTrackerCardProps) => {
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

  const categoryColor = getCategoryColor(tracker.category);
  const Icon = getTrackerIcon(tracker.title, tracker.category);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={`
          card-premium breathing-space animate-fade-in hover:shadow-lg transition-all relative
          ${isDragging ? 'shadow-2xl opacity-50' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          <button
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing p-2 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>
          
          <div
            onClick={() => onSelect(tracker)}
            className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
            >
              <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-base truncate">{localizeTrackerTitle(tracker.title)}</h3>
              <p
                className="text-xs uppercase tracking-wider mt-1"
                style={{ color: `hsl(var(--${categoryColor}))` }}
              >
                {tracker.category}
              </p>
              <p className="text-sm text-muted-foreground mt-2 font-playful line-clamp-2">
                {localizeTrackerQuestion(tracker.questionText)}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-background z-50">
              <DropdownMenuItem onClick={() => onEdit(tracker)}>
                <Settings className="h-4 w-4 mr-2" />
                Edit tracker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onArchive(tracker)}>
                <Archive className="h-4 w-4 mr-2" />
                Pause (keep data)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(tracker)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete forever
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  );
};
