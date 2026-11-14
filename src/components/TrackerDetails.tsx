// A question in My questions (the lamb → My questions → tap a question). Since Nov 14 2026 only what this list is
// for (her note: «давай тут просто сделаем возможность его отредактировать, удалить или архивировать… а вся остальная
// информация сутевая пусть будет… там, где у нас она уже есть»): Edit, Archive, Delete, and one way to the page of
// this question on the World (its days, links, when to act, what helps). The month dots and the limit bar are gone:
// the days are in My days, the rule is in When to act.
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, ChevronRight, Pencil, Trash2, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { Tracker } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { cardQuestion } from "@/lib/cardText";
import { islandName, islandOf } from "@/lib/islands";
import { cn } from "@/lib/utils";

interface TrackerDetailsProps {
  tracker: Tracker;
  trackers?: Tracker[];
  currentIndex?: number;
  onBack?: () => void;
  onNavigateTracker?: (direction: "prev" | "next") => void;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  // Management actions. When omitted, the buttons are hidden.
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  /** the page of this question on the World */
  onAll?: () => void;
}

export const TrackerDetails = ({ tracker, onEdit, onArchive, onDelete, onAll }: TrackerDetailsProps) => {
  const { t } = useTranslation();
  const row = (Icon: ComponentType<LucideProps>, label: string, onClick: () => void, opts: { danger?: boolean; data: string }) => (
    <button type="button" data-question-action={opts.data} onClick={() => { haptics.tap(); onClick(); }}
      className={cn("flex h-[60px] w-full items-center gap-3.5 px-4 text-left active:bg-foreground/[0.04]", opts.danger && "text-destructive")}>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", opts.danger ? "bg-destructive/10" : "bg-[hsl(var(--coin-teal)/0.14)] text-[hsl(var(--coin-teal))]")}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 text-[17px] font-semibold">{label}</span>
    </button>
  );
  return (
    // Side padding keeps card borders off the BottomSheet's clipped edges.
    <div data-question-sheet className="px-5 pb-12 animate-fade-in">
      <p className="pr-10 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{islandName(t, islandOf(tracker))}</p>
      <h2 className="mt-0.5 pr-10 text-[24px] font-bold leading-tight tracking-tight">{cardQuestion(tracker)}</h2>
      <div className="surface mt-5 divide-y divide-foreground/[0.07] overflow-hidden rounded-[20px]">
        {onEdit && row(Pencil, t("trackerDetails.actionEdit"), onEdit, { data: "edit" })}
        {onArchive && row(tracker.archived ? ArchiveRestore : Archive, tracker.archived ? t("trackerDetails.actionUnarchive") : t("trackerDetails.actionArchive"), () => { haptics.warning(); onArchive(); }, { data: "archive" })}
        {onDelete && row(Trash2, t("trackerDetails.actionDelete"), () => { haptics.warning(); onDelete(); }, { danger: true, data: "delete" })}
      </div>
      {onAll && !tracker.archived && (
        <button type="button" data-question-all onClick={() => { haptics.tap(); onAll(); }}
          className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 px-1 text-left text-[16px] font-bold text-[hsl(var(--coin-teal))]">
          <span className="min-w-0 flex-1">{t("link.thingAll", { thing: cardQuestion(tracker) })}</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
};
