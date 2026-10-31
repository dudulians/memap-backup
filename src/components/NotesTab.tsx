// Notes (1.8.0): a big heading with "+", notes grouped by day, and one
// sheet for writing or editing: the text first, then the day and an
// optional question as big buttons. Tap a note to edit or delete it.
// The labelled form, the subtitle and the tiny edit / trash icons of
// 1.7.9 are gone (design rule: people who hate reading).
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Plus, X, ArrowLeft, Search, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Note, getNotes, addNote, updateNote, deleteNote } from "@/lib/notes";
import { Tracker } from "@/types/tracker";
import { getTrackers } from "@/lib/storage";
import { format, parseISO } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { daysAgoIso, getDoorState } from "@/lib/doors";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import maluWave from "@/assets/malu/malu-wave.webp";
import { SHOW_MASCOT } from "@/lib/mascot";

interface NotesTabProps {
  targetDate?: string;
  onBack?: () => void;
  backLabel?: string;
}

// The search box appears once there's enough to search through.
const SEARCH_FROM = 6;

type Draft = { id?: string; date: string; text: string; linkedPatternId: string };

export const NotesTab = ({ targetDate, onBack, backLabel }: NotesTabProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [notes, setNotes] = useState<Note[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedDate, setHighlightedDate] = useState<string | undefined>(targetDate);

  const today = daysAgoIso(0);
  const yesterday = daysAgoIso(1);

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
    const [notesData, trackersData] = await Promise.all([getNotes(), getTrackers()]);
    setNotes(notesData.sort((a, b) => b.date.localeCompare(a.date)));
    setTrackers(trackersData.filter((tr) => !tr.archived));
    setLoading(false);
  };

  // Door questions go by their door name, like everywhere else.
  const door = getDoorState();
  const trackerName = (id?: string) => {
    if (!id) return null;
    const doorId = door?.trackerId === id ? door.id : door?.extra?.find((x) => x.trackerId === id)?.id;
    if (doorId) return t(`doors.${doorId}.name`);
    const raw = trackers.find((tr) => tr.id === id)?.title;
    return raw ? localizeTrackerTitle(raw) : null;
  };

  const dayLabel = (iso: string) => {
    if (iso === today) return t("doors.when.today");
    if (iso === yesterday) return t("doors.when.yesterday");
    const d = parseISO(iso);
    return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMMM" : "d MMMM yyyy", { locale: dateLocale });
  };

  const save = async () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) return;
    if (draft.id) {
      await updateNote(draft.id, { text, date: draft.date, linkedPatternId: draft.linkedPatternId || undefined });
      toast({ title: t("notesTab.noteUpdated") });
    } else {
      await addNote({ date: draft.date, text, linkedPatternId: draft.linkedPatternId || undefined });
      toast({ title: t("notesTab.noteAdded") });
    }
    setDraft(null);
    loadData();
  };

  const remove = async () => {
    if (!draft?.id) return;
    await deleteNote(draft.id);
    toast({ title: t("notesTab.noteDeleted") });
    setDeleteDialogOpen(false);
    setDraft(null);
    loadData();
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredNotes = q
    ? notes.filter((note) => {
        if (note.text.toLowerCase().includes(q)) return true;
        // 1.7.9 searched note.trackerId, which never existed, so a
        // question name never matched.
        const name = trackerName(note.linkedPatternId);
        return !!name && name.toLowerCase().includes(q);
      })
    : notes;

  const groupedNotes = filteredNotes.reduce((acc, note) => {
    (acc[note.date] ??= []).push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  const chip = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 h-11 px-4 rounded-full border text-[16px] transition-colors",
      on ? "border-[1.5px] border-primary bg-primary/15 text-primary font-semibold" : "border-foreground/[0.18] bg-foreground/[0.05] font-medium",
    );

  return (
    <>
      <div className="space-y-5 pb-20">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground transition-colors -mt-2 animate-fade-in"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel ?? t("common.back")}
          </button>
        )}

        <div className="flex items-center justify-between gap-3 animate-fade-in">
          <h1 className="text-[28px] font-bold tracking-tight">{t("notesTab.title")}</h1>
          {notes.length > 0 && (
            <button
              type="button"
              onClick={() => setDraft({ date: today, text: "", linkedPatternId: "" })}
              aria-label={t("notesTab.write")}
              className="h-11 w-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground active:scale-95 transition-transform"
            >
              <Plus className="h-5 w-5" strokeWidth={2.6} />
            </button>
          )}
        </div>

        {!loading && notes.length >= SEARCH_FROM && (
          <div className="relative animate-fade-in">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("addTracker.search")}
              className="h-12 pl-12 pr-11 rounded-2xl text-base bg-foreground/[0.06] border-foreground/[0.14]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground"
                aria-label={t("notesTab.clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {loading ? null : notes.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-10 animate-fade-in">
            {SHOW_MASCOT && <img src={maluWave} alt="" className="h-32 w-32" />}
            <p className="mt-2 text-[22px] font-bold">{t("notesTab.empty")}</p>
            <Button
              onClick={() => setDraft({ date: today, text: "", linkedPatternId: "" })}
              className="mt-6 w-full h-[54px] rounded-full text-[17px] font-semibold"
            >
              {t("notesTab.write")}
            </Button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <p className="pt-10 text-center text-[17px] text-muted-foreground animate-fade-in">{t("addTracker.nothingFound")}</p>
        ) : (
          <div className="space-y-5 animate-fade-in">
            {Object.entries(groupedNotes).map(([date, dateNotes]) => (
              <div
                key={date}
                id={`notes-date-${date}`}
                className={cn("space-y-2 rounded-[22px] transition-colors duration-700", highlightedDate === date && "bg-primary/10 -mx-2 px-2 py-2")}
              >
                <p className="px-1 text-[17px] font-semibold text-muted-foreground">{dayLabel(date)}</p>
                {dateNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setDraft({ id: note.id, date: note.date, text: note.text, linkedPatternId: note.linkedPatternId ?? "" })}
                    className="block w-full text-left rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-[18px] py-4 active:scale-[0.99] transition-transform"
                  >
                    <p className="text-[17px] leading-snug whitespace-pre-line line-clamp-6">{note.text}</p>
                    {note.linkedPatternId && trackerName(note.linkedPatternId) && (
                      <span className="mt-3 inline-flex items-center h-8 px-3 rounded-full bg-foreground/[0.08] text-[14px] font-semibold">
                        {trackerName(note.linkedPatternId)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write / edit sheet */}
      <BottomSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        className="h-[86vh]"
        ariaTitle={draft?.id ? t("notesTab.editNote") : t("notesTab.newNote")}
      >
        {draft && (
          <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col">
            <h2 className="text-[22px] font-bold tracking-tight pr-10">
              {draft.id ? t("notesTab.editNote") : t("notesTab.newNote")}
            </h2>
            <Textarea
              autoFocus={!draft.id}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder={t("notesTab.placeholder")}
              aria-label={t("notesTab.newNote")}
              className="mt-4 min-h-[150px] rounded-2xl text-[17px] leading-snug bg-foreground/[0.06] border-foreground/[0.14]"
            />

            <div className="mt-5 flex flex-wrap gap-2">
              {[today, yesterday].map((iso) => (
                <button key={iso} type="button" onClick={() => setDraft({ ...draft, date: iso })} className={chip(draft.date === iso)}>
                  {iso === today ? t("doors.when.today") : t("doors.when.yesterday")}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={chip(draft.date !== today && draft.date !== yesterday)}>
                    <CalendarDays className="h-4 w-4" />
                    {draft.date !== today && draft.date !== yesterday ? dayLabel(draft.date) : t("notesTab.otherDay")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    locale={dateLocale}
                    selected={parseISO(draft.date)}
                    onSelect={(d) => {
                      if (d) setDraft({ ...draft, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` });
                    }}
                    disabled={(d) => d > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Optional: which question this note is about. It also shows
                on that question's calendar day. */}
            {trackers.length > 0 && (
              <div className="mt-4 -mx-5 px-5 flex gap-2 overflow-x-auto scrollbar-hide">
                {trackers.map((tr) => {
                  const on = draft.linkedPatternId === tr.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, linkedPatternId: on ? "" : tr.id })}
                      className={cn(chip(on), "shrink-0 max-w-[240px] truncate")}
                    >
                      {trackerName(tr.id)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 min-h-6" />
            <Button
              onClick={save}
              disabled={!draft.text.trim()}
              className="mt-6 w-full h-[54px] rounded-full text-[17px] font-semibold"
            >
              {t("common.save")}
            </Button>
            {draft.id && (
              <Button
                variant="ghost"
                onClick={() => setDeleteDialogOpen(true)}
                className="mt-2 w-full h-11 rounded-full text-[16px] text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {t("common.delete")}
              </Button>
            )}
          </div>
        )}
      </BottomSheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notesTab.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("notesTab.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
