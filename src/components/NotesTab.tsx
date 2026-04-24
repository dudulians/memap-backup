import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2, Calendar, Tag, X, ArrowLeft, Search } from "lucide-react";
import { Note, getNotes, addNote, updateNote, deleteNote } from "@/lib/notes";
import { Tracker } from "@/types/tracker";
import { getTrackers } from "@/lib/storage";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface NotesTabProps {
  targetDate?: string;
  onBack?: () => void;
  backLabel?: string;
}

export const NotesTab = ({ targetDate, onBack, backLabel }: NotesTabProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedDate, setHighlightedDate] = useState<string | undefined>(targetDate);

  const today = new Date().toISOString().split("T")[0];
  const [newNote, setNewNote] = useState({
    date: today,
    text: "",
    linkedPatternId: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!targetDate || loading) return;
    const el = document.getElementById(`notes-date-${targetDate}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedDate(targetDate);
      setTimeout(() => setHighlightedDate(undefined), 2500);
    }
  }, [targetDate, loading]);

  const loadData = async () => {
    setLoading(true);
    const [notesData, trackersData] = await Promise.all([
      getNotes(),
      getTrackers(),
    ]);
    setNotes(notesData.sort((a, b) => b.date.localeCompare(a.date)));
    setTrackers(trackersData.filter(t => !t.archived));
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNote.text.trim()) {
      toast({
        title: "Note is empty",
        description: "Please write something before saving.",
        variant: "destructive",
      });
      return;
    }

    await addNote({
      date: newNote.date,
      text: newNote.text,
      linkedPatternId: newNote.linkedPatternId || undefined,
    });

    toast({ title: "Note added", description: "Your note has been saved." });
    setNewNote({ date: today, text: "", linkedPatternId: "" });
    setIsAdding(false);
    loadData();
  };

  const handleUpdateNote = async () => {
    if (!editingNote) return;

    await updateNote(editingNote.id, {
      text: editingNote.text,
      linkedPatternId: editingNote.linkedPatternId || undefined,
      date: editingNote.date,
    });

    toast({ title: "Note updated", description: "Your changes have been saved." });
    setEditingNote(null);
    loadData();
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;

    await deleteNote(noteToDelete.id);
    toast({ title: "Note deleted", description: "The note has been removed." });
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
    loadData();
  };

  const getTrackerName = (id?: string) => {
    if (!id) return null;
    return trackers.find(t => t.id === id)?.title;
  };

  const filteredNotes = searchQuery.trim()
    ? notes.filter((note) => {
        const q = searchQuery.trim().toLowerCase();
        if (note.text.toLowerCase().includes(q)) return true;
        const trackerName = getTrackerName(note.trackerId);
        if (trackerName && trackerName.toLowerCase().includes(q)) return true;
        if (note.date.includes(q)) return true;
        return false;
      })
    : notes;

  const groupedNotes = filteredNotes.reduce((acc, note) => {
    if (!acc[note.date]) acc[note.date] = [];
    acc[note.date].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  return (
    <>
      <div className="space-y-6 pb-20">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mt-2 animate-fade-in"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel ?? "Back"}
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-1 animate-fade-in">
          <p className="text-lg font-medium tracking-wide">Your Notes</p>
          <p className="text-sm text-muted-foreground">
            Reflections and thoughts tied to your days.
          </p>
        </div>

        {/* Add Note Button or Form */}
        {!isAdding && !editingNote ? (
          <Button
            onClick={() => setIsAdding(true)}
            className="w-full rounded-full animate-fade-in"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add note
          </Button>
        ) : isAdding ? (
          <Card className="card-premium animate-fade-in">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">New Note</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsAdding(false);
                    setNewNote({ date: today, text: "", linkedPatternId: "" });
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newNote.date}
                  onChange={(e) => setNewNote({ ...newNote, date: e.target.value })}
                  max={today}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Linked pattern (optional)</Label>
                <Select
                  value={newNote.linkedPatternId || "none"}
                  onValueChange={(v) => setNewNote({ ...newNote, linkedPatternId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trackers.map(tracker => (
                      <SelectItem key={tracker.id} value={tracker.id}>
                        {tracker.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Your note</Label>
                <Textarea
                  placeholder="Write your reflection..."
                  value={newNote.text}
                  onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <Button onClick={handleAddNote} className="w-full rounded-full">
                Save Note
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Editing Form */}
        {editingNote && (
          <Card className="card-premium animate-fade-in">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Edit Note</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingNote(null)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={editingNote.date}
                  onChange={(e) => setEditingNote({ ...editingNote, date: e.target.value })}
                  max={today}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Linked pattern</Label>
                <Select
                  value={editingNote.linkedPatternId || "none"}
                  onValueChange={(v) => setEditingNote({ ...editingNote, linkedPatternId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trackers.map(tracker => (
                      <SelectItem key={tracker.id} value={tracker.id}>
                        {tracker.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Your note</Label>
                <Textarea
                  value={editingNote.text}
                  onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <Button onClick={handleUpdateNote} className="w-full rounded-full">
                Save Changes
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        {!loading && notes.length > 0 && (
          <div className="relative animate-fade-in">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes..."
              className="pl-9 pr-9 rounded-full bg-muted/40 border-border/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Notes List */}
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : notes.length === 0 && !isAdding ? (
          <div className="text-center py-12 space-y-2 animate-fade-in">
            <p className="text-muted-foreground">No notes yet</p>
            <p className="text-xs text-muted-foreground">Start writing your reflections</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12 space-y-2 animate-fade-in">
            <p className="text-muted-foreground">No notes match "{searchQuery}"</p>
            <button onClick={() => setSearchQuery("")} className="text-xs text-primary hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {Object.entries(groupedNotes).map(([date, dateNotes]) => (
              <div
                key={date}
                id={`notes-date-${date}`}
                className={`space-y-2 rounded-xl transition-colors duration-700 ${highlightedDate === date ? "bg-primary/10 -mx-2 px-2 py-1" : ""}`}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{format(parseISO(date), "MMMM d, yyyy")}</span>
                </div>

                {dateNotes.map(note => (
                  <Card key={note.id} className="card-premium">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-3">{note.text}</p>
                          {note.linkedPatternId && (
                            <div className="mt-2 flex items-center gap-1">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="secondary" className="text-xs">
                                {getTrackerName(note.linkedPatternId)}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingNote(note)}
                            className="h-7 w-7"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setNoteToDelete(note);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-7 w-7 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNote} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
