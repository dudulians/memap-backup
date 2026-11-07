// Notes (1.8.0): a big heading with "+", notes grouped by day, and one
// sheet for writing or editing: the text first, then the day and an
// optional question as big buttons. Tap a note to edit or delete it.
// The labelled form, the subtitle and the tiny edit / trash icons of
// 1.7.9 are gone (design rule: people who hate reading).
import { TipCard, tourCompleted } from "./Tips";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteSheet, newDraft, useQuestionName, type NoteDraft } from "@/components/NoteSheet";
import { Plus, X, ArrowLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Note, getNotes } from "@/lib/notes";
import { Tracker } from "@/types/tracker";
import { getTrackers } from "@/lib/storage";
import { format, parseISO } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { daysAgoIso } from "@/lib/doors";
import maluWave from "@/assets/malu/malu-wave.webp";
import { SHOW_MASCOT } from "@/lib/mascot";

interface NotesTabProps {
  targetDate?: string;
  onBack?: () => void;
  backLabel?: string;
}

// The search box appears once there's enough to search through.
const SEARCH_FROM = 6;

export const NotesTab = ({ targetDate, onBack, backLabel }: NotesTabProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [notes, setNotes] = useState<Note[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
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
  const trackerName = useQuestionName(trackers);

  const dayLabel = (iso: string) => {
    if (iso === today) return t("doors.when.today");
    if (iso === yesterday) return t("doors.when.yesterday");
    const d = parseISO(iso);
    return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMMM" : "d MMMM yyyy", { locale: dateLocale });
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

  return (
    <>
      <div className="space-y-5 pb-20">
        {!tourCompleted() && <TipCard id="block:notes" title={t("common.notes")} line={t("tour.notes.line")} />}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground transition-colors -mt-2 animate-fade-in"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel ?? t("common.back")}
          </button>
        )}

        <div className="flex items-center justify-between gap-3 pb-2 animate-fade-in">
          <h1 className="text-[28px] font-bold tracking-tight">{t("notesTab.title")}</h1>
          {notes.length > 0 && (
            <button
              type="button"
              onClick={() => setDraft(newDraft(today))}
              aria-label={t("notesTab.write")}
              className="raised-btn is-icon"
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
            <button type="button" onClick={() => setDraft(newDraft(today))} className="raised-btn mt-6 w-full justify-center">
              {t("notesTab.write")}
            </button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <p className="pt-10 text-center text-[17px] text-muted-foreground animate-fade-in">{t("addTracker.nothingFound")}</p>
        ) : (
          <div className="space-y-5 animate-fade-in">
            {Object.entries(groupedNotes).map(([date, dateNotes]) => (
              <div
                key={date}
                id={`notes-date-${date}`}
                className={cn("space-y-2 rounded-[22px] transition-colors duration-700", highlightedDate === date && "bg-foreground/[0.06] -mx-2 px-2 py-2")}
              >
                <p className="px-1 text-[17px] font-semibold text-muted-foreground">{dayLabel(date)}</p>
                {dateNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setDraft({ id: note.id, date: note.date, text: note.text, linkedPatternId: note.linkedPatternId ?? "" })}
                    className="surface block w-full text-left rounded-[22px] px-[18px] py-4 active:scale-[0.99] transition-transform"
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

      {/* Write / edit sheet (shared with Today's note step). */}
      <NoteSheet draft={draft} setDraft={setDraft} trackers={trackers} onSaved={loadData} />
    </>
  );
};
