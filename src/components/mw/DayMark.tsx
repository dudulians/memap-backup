// What sits in a day's square, everywhere in Malu's world (1.9).
// Two separate questions, two separate signals, so nothing has to be
// decoded (phone testing: "called mom = yes" showed a pencil curl,
// because the sticker used to mean "the bad side"):
//   shape  = what was answered: a sticker for "yes", a pencil curl for "no"
//   colour = how it was: a green square is a good day for this question,
//            a pink one a bad day (same reading as the 1.7.9 calendar)
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tracker } from "@/types/tracker";
import { isHit } from "@/lib/weekMap";
import { PencilCurl, TopicIcon, TopicKind } from "./TopicIcon";

export type DayMood = "good" | "bad";

/** For the square's data-mood attribute. */
export const moodOf = (tracker: Pick<Tracker, "problemWhen">, value: boolean | undefined): DayMood | undefined =>
  value === undefined ? undefined : isHit(tracker as Tracker, value) ? "bad" : "good";

export const DayMark = ({
  value,
  kind,
  size = 30,
  className,
  style,
  slap,
}: {
  value: boolean | undefined | null;
  kind: TopicKind;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  slap?: boolean;
}) => {
  if (value === true) {
    return <TopicIcon kind={kind} size={size} sticker className={cn("absolute", slap && "mw-slap", className)} style={style} />;
  }
  if (value === false) {
    return (
      <span className={cn(slap && "mw-slap")} style={slap ? { animationDelay: style?.animationDelay } : undefined}>
        <PencilCurl size={Math.round(size * 0.6)} />
      </span>
    );
  }
  return null;
};

/** "green = good, pink = bad" in two tiny squares. */
export const MoodLegend = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  return (
    <div className={cn("flex items-center justify-center gap-4 text-[15px] font-semibold text-muted-foreground", className)}>
      <span className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded-[4px] bg-[hsl(var(--mw-good))]" />
        {t("week.good")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded-[4px] bg-[hsl(var(--mw-bad))]" />
        {t("week.bad")}
      </span>
    </div>
  );
};
