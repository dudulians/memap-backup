import { useState, useRef, useEffect } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Note, getNotes, addNote } from "@/lib/notes";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Check, X, FileText, Plus, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerQuestion } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";

interface CalendarAnswerEditorProps {
  open: boolean;
  onClose: () => void;
  tracker: Tracker;
  date: string;
  existingEntry?: TrackerEntry;
  onSave: (trackerId: string, date: string, value: boolean) => Promise<void>;
  /**
   * Optional. When provided, the editor shows a "Clear answer" button
   * for days that already have an entry. Useful when the user tapped
   * Yes/No accidentally and wants the day to count as un-answered
   * again (so e.g. notifications still fire later in the day).
   */
  onClear?: (trackerId: string, date: string) => Promise<void>;
}

export const CalendarAnswerEditor = ({
  open,
  onClose,
  tracker,
  date,
  existingEntry,
  onSave,
  onClear,
}: CalendarAnswerEditorProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [selectedValue, setSelectedValue] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const swipeStartX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedValue(existingEntry?.value ?? null);
      setSwipeOffset(0);
      setNewNoteText("");
      setShowNoteInput(false);
      getNotes().then(all => setNotes(all.filter(n => n.date === date)));
    }
  }, [open, existingEntry, date]);

  const categoryColor = getCategoryColor(tracker.category);
  const formattedDate = format(new Date(date + "T00:00:00"), "MMMM d, yyyy", { locale: dateLocale });
  const yesIsSignificant = tracker.problemWhen === "yes";

  const handleSave = async (value: boolean) => {
    setSaving(true);
    try {
      await onSave(tracker.id, date, value);
      setSelectedValue(value);
      haptics.success();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!onClear) return;
    setSaving(true);
    try {
      await onClear(tracker.id, date);
      setSelectedValue(null);
      haptics.tap();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const note = await addNote({ date, text: newNoteText.trim(), linkedPatternId: tracker.id });
      setNotes(prev => [...prev, note]);
      haptics.success();
      setNewNoteText("");
      setShowNoteInput(false);
      window.dispatchEvent(new CustomEvent("memap-notes-changed"));
    } finally {
      setSavingNote(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - swipeStartX.current;
    setSwipeOffset(Math.max(-100, Math.min(100, diff)));
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeOffset) > 60) {
      handleSave(swipeOffset > 0 ? true : false);
    }
    setSwipeOffset(0);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="h-auto max-h-[80vh]"
      ariaTitle={format(new Date(date + "T00:00:00"), "d MMM yyyy", { locale: dateLocale })}
    >
      <div className="px-6 pt-3 pb-2 flex-shrink-0">
        <h2 className="text-base font-semibold">
          {format(new Date(date + "T00:00:00"), "d MMM yyyy", { locale: dateLocale })}
        </h2>
      </div>

      {/* Body opts out of vaul drag so internal scroll is unimpeded.
          Dismiss-by-drag still works from the pill / top header. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4 pb-8">
          {/* Pattern info */}
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            {(() => {
              const CIcon = getTrackerIcon(tracker.title, tracker.category);
              return <CIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />;
            })()}
            <span className="font-medium text-foreground">{localizeTrackerTitle(tracker.title)}</span>
          </p>

          {/* Question card with swipe */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-2xl bg-muted/30 p-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-16 flex items-center justify-center transition-opacity",
                swipeOffset < -30 ? "opacity-100" : "opacity-0"
              )}
              style={{ backgroundColor: `hsl(var(--${yesIsSignificant ? "strong" : "balanced"}) / 0.2)` }}
            >
              <X className="h-6 w-6" style={{ color: `hsl(var(--${yesIsSignificant ? "strong" : "balanced"}))` }} />
            </div>
            <div
              className={cn(
                "absolute inset-y-0 right-0 w-16 flex items-center justify-center transition-opacity",
                swipeOffset > 30 ? "opacity-100" : "opacity-0"
              )}
              style={{ backgroundColor: `hsl(var(--${yesIsSignificant ? "balanced" : "strong"}) / 0.2)` }}
            >
              <Check className="h-6 w-6" style={{ color: `hsl(var(--${yesIsSignificant ? "balanced" : "strong"}))` }} />
            </div>

            <div
              className="relative z-10 transition-transform"
              style={{ transform: `translateX(${swipeOffset * 0.3}px)` }}
            >
              <p className="text-sm leading-relaxed text-foreground">{localizeTrackerQuestion(tracker.questionText)}</p>
            </div>
          </div>

          {/* Yes/No buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              onClick={() => handleSave(false)}
              disabled={saving}
              className={cn(
                "h-14 rounded-xl text-base font-medium transition-all border",
                selectedValue === false
                  ? yesIsSignificant
                    ? "bg-balanced/20 border-balanced text-balanced"
                    : "bg-strong/20 border-strong text-strong"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <X className="h-5 w-5 mr-2" />
              {t("common.no")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleSave(true)}
              disabled={saving}
              className={cn(
                "h-14 rounded-xl text-base font-medium transition-all border",
                selectedValue === true
                  ? yesIsSignificant
                    ? "bg-strong/20 border-strong text-strong"
                    : "bg-balanced/20 border-balanced text-balanced"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <Check className="h-5 w-5 mr-2" />
              {t("common.yes")}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t("calendarEditor.tapOrSwipe")}
          </p>

          {/* Clear-answer affordance — only visible when this day
              already has an entry AND the parent wired up onClear.
              Lets the user "un-answer" a day so it counts as
              untracked again (handy when she ticked something off
              by reflex and wants the notification to fire later, or
              just wants the day to show as empty in the calendar). */}
          {onClear && existingEntry && (
            <button
              type="button"
              onClick={handleClear}
              disabled={saving}
              className="block mx-auto text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {t("calendarEditor.clearAnswer")}
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-border/40" />

          {/* Notes section */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <StickyNote className="h-3 w-3" />
              {t("calendarEditor.notesForDay")}
            </p>

            {/* Existing notes */}
            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl bg-muted/40 border border-border/60"
                  >
                    <p className="text-xs text-foreground/80 leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            )}

            {notes.length === 0 && !showNoteInput && (
              <p className="text-xs text-muted-foreground text-center py-1">
                {t("calendarEditor.noNotesYet")}
              </p>
            )}

            {/* Prominent Add note button — full width, visible */}
            {!showNoteInput && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNoteInput(true)}
                style={{ touchAction: "manipulation" }}
                className="w-full rounded-xl h-10 text-sm gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                {t("calendarEditor.addNoteForDay")}
              </Button>
            )}

            {/* New note input */}
            {showNoteInput && (
              <div className="space-y-2 animate-fade-in">
                <textarea
                  autoFocus
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  placeholder={t("calendarEditor.noteInputPh")}
                  rows={3}
                  className="w-full text-sm rounded-xl border border-border bg-muted/30 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowNoteInput(false); setNewNoteText(""); }}
                    className="flex-1 rounded-full text-xs h-8"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={savingNote || !newNoteText.trim()}
                    className="flex-1 rounded-full text-xs h-8"
                  >
                    {t("calendarEditor.saveNote")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
    </BottomSheet>
  );
};
