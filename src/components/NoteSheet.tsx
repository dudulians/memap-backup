// The sheet for writing or editing a note: the text first (keyboard up),
// the big mic, then the day and an optional question as big buttons.
// Used by Notes and, since Nov 2 2026, straight from Today's "Write a note"
// step (her: "нажала шаг ноут — сразу пишешь, а не ещё раз нажимаешь").
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DictateButton } from "@/components/DictateButton";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { addNote, deleteNote, updateNote } from "@/lib/notes";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { daysAgoIso, getDoorState } from "@/lib/doors";
import { Tracker } from "@/types/tracker";

export type NoteDraft = { id?: string; date: string; text: string; linkedPatternId: string };

export const newDraft = (date = daysAgoIso(0)): NoteDraft => ({ date, text: "", linkedPatternId: "" });

/** A question's name the way notes show it (door questions by their door name). */
export const useQuestionName = (trackers: Tracker[]) => {
  const { t } = useTranslation();
  const door = getDoorState();
  return (id?: string) => {
    if (!id) return null;
    const doorId = door?.trackerId === id ? door.id : door?.extra?.find((x) => x.trackerId === id)?.id;
    if (doorId) return t(`doors.${doorId}.name`);
    const raw = trackers.find((tr) => tr.id === id)?.title;
    return raw ? localizeTrackerTitle(raw) : null;
  };
};

export const NoteSheet = ({
  draft,
  setDraft,
  trackers,
  onSaved,
  footer,
}: {
  draft: NoteDraft | null;
  setDraft: (d: NoteDraft | null) => void;
  trackers: Tracker[];
  /** After save or delete. */
  onSaved: () => void;
  /** Extra quiet links under Save (Today: "All notes", "Not today"). */
  footer?: ReactNode;
}) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const nameOf = useQuestionName(trackers);
  const today = daysAgoIso(0);
  const yesterday = daysAgoIso(1);

  const dayLabel = (iso: string) => {
    const d = parseISO(iso);
    return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMMM" : "d MMMM yyyy", { locale: dateLocale });
  };
  // the Aurora kit (Nov 5 2026): switches and filters look like Map | Globe
  const chip = (on: boolean) => cn("chip", on && "is-on");

  // No "Note added" popup: the note shows up where she looks (her call on
  // popups, Nov 2 2026).
  const save = async () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (!text) return;
    if (draft.id) await updateNote(draft.id, { text, date: draft.date, linkedPatternId: draft.linkedPatternId || undefined });
    else await addNote({ date: draft.date, text, linkedPatternId: draft.linkedPatternId || undefined });
    haptics.success();
    setDraft(null);
    window.dispatchEvent(new CustomEvent("memap-notes-changed"));
    onSaved();
  };
  const remove = async () => {
    if (!draft?.id) return;
    await deleteNote(draft.id);
    setDeleteOpen(false);
    setDraft(null);
    window.dispatchEvent(new CustomEvent("memap-notes-changed"));
    onSaved();
  };

  return (
    <>
      <BottomSheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} className="h-[86vh]"
        ariaTitle={draft?.id ? t("notesTab.editNote") : t("notesTab.newNote")}>
        {draft && (
          <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col">
            <h2 className="text-[22px] font-bold tracking-tight pr-10">{draft.id ? t("notesTab.editNote") : t("notesTab.newNote")}</h2>
            <Textarea
              ref={noteRef}
              autoFocus={!draft.id}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder={t("notesTab.placeholder")}
              aria-label={t("notesTab.newNote")}
              className="mt-4 min-h-[150px] rounded-2xl text-[17px] leading-snug bg-foreground/[0.04] border-foreground/[0.12] focus-visible:ring-2 focus-visible:ring-[hsl(var(--coin-teal))] focus-visible:ring-offset-0"
            />
            <div className="mt-3">
              <DictateButton text={draft.text} onText={(next) => setDraft({ ...draft, text: next })} />
            </div>

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
                    <button key={tr.id} type="button" onClick={() => setDraft({ ...draft, linkedPatternId: on ? "" : tr.id })}
                      className={cn(chip(on), "block max-w-[240px] truncate leading-[38px]")}>
                      {nameOf(tr.id)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 min-h-6" />
            <button type="button" onClick={save} disabled={!draft.text.trim()} className="raised-btn mt-6 w-full justify-center">
              {t("common.save")}
            </button>
            {draft.id && (
              <button type="button" onClick={() => setDeleteOpen(true)} className="mt-2 h-11 w-full text-[16px] font-semibold text-muted-foreground">
                {t("common.delete")}
              </button>
            )}
            {footer}
          </div>
        )}
      </BottomSheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notesTab.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("notesTab.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
