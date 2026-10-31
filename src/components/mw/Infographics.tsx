// Small animated infographics that explain MeMap without paragraphs
// (phone testing, Oct 31: "nothing explains what it's for or how it
// will fill up"). Everything is drawn with the same pieces as the real
// screens (notebook squares, stickers, curls, green/pink), so what you
// see here is what you'll get. Animations are CSS only and start on
// mount; reduced motion shows the end state.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DoorId } from "@/lib/doors";
import { Glyph } from "./Glyph";
import { PencilCurl, TopicIcon, TopicKind, topicKind } from "./TopicIcon";
import { tilt } from "./WeekMap";

const DROP = "mw-drop";

/** A month of notebook squares; `hits` are the day numbers (1-based)
 *  with a sticker, the rest get a curl. Stickers slap in one by one. */
export const MiniMonth = ({
  kind,
  hits,
  days = 30,
  delay = 0,
  cell = 26,
  curls = true,
}: {
  kind: TopicKind;
  hits: number[];
  days?: number;
  delay?: number;
  cell?: number;
  curls?: boolean;
}) => {
  let n = 0;
  return (
    <div className="grid grid-cols-7 gap-[3px]" style={{ width: cell * 7 + 18 }} aria-hidden="true">
      {Array.from({ length: Math.ceil(days / 7) * 7 }, (_, i) => {
        const day = i + 1;
        if (day > days) return <span key={i} />;
        const hit = hits.includes(day);
        const order = hit ? n++ : 0;
        return (
          <span
            key={i}
            className="mw-cell !rounded-[4px]"
            data-mood={hit ? "bad" : curls ? "good" : undefined}
            style={{ width: cell, height: cell }}
          >
            {hit ? (
              <TopicIcon
                kind={kind}
                size={cell + 4}
                sticker
                className="absolute mw-slap"
                style={{ ["--r" as string]: `${tilt(kind + day)}deg`, animationDelay: `${delay + order * 260}ms` }}
              />
            ) : (
              curls && <PencilCurl size={Math.round(cell * 0.55)} />
            )}
          </span>
        );
      })}
    </div>
  );
};

/** "Why": memory says every day, the page says 5 out of 30. */
export const WhyArt = () => {
  const { t } = useTranslation();
  const kinds: TopicKind[] = ["fight", "migraine", "drink", "fight", "kid", "fight", "migraine", "fight", "drink", "fight", "mood", "fight"];
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("mw-sheet px-4 py-3.5", DROP)}>
        <p className="mw-hand text-[19px] text-muted-foreground">{t("mw.why.feels")}</p>
        <div className="flex items-center gap-3">
          <p className="mw-display text-[26px] leading-tight shrink-0">{t("mw.why.feelsBig")}</p>
          <div className="relative flex-1 h-[64px]" aria-hidden="true">
            {kinds.map((k, i) => (
              <TopicIcon
                key={i}
                kind={k}
                size={34}
                sticker
                className="absolute mw-jitter"
                style={{
                  left: `${(i * 37) % 86}%`,
                  top: `${(i * 23) % 46}px`,
                  ["--r" as string]: `${tilt("w" + i) * 3}deg`,
                  animationDelay: `${i * 70}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={cn("mw-sheet px-4 py-3.5", DROP)} style={{ animationDelay: "700ms" }}>
        <p className="mw-hand text-[19px] text-muted-foreground">{t("mw.why.really")}</p>
        <div className="mt-1.5 flex items-end gap-4">
          <MiniMonth kind="fight" hits={[4, 11, 16, 23, 27]} delay={1100} cell={24} />
          <p className="mw-display text-[24px] leading-tight pb-1">{t("mw.why.reallyBig")}</p>
        </div>
      </div>
    </div>
  );
};

const HOW_HITS: Record<DoorId, number[]> = {
  fights: [3, 9, 10, 17, 24],
  migraine: [5, 6, 13, 20, 28],
  drinking: [2, 6, 13, 14, 20, 27],
  kid: [4, 8, 15, 22, 23],
  mood: [7, 8, 15, 21, 29],
};

/** "How it will go for you": four steps that drop in one after another,
 *  drawn with the person's own topic. */
export const HowSteps = ({ door }: { door: DoorId }) => {
  const { t } = useTranslation();
  const kind = topicKind("", door);
  const [tapped, setTapped] = useState(false);
  // The little "Yes" in step 1 presses itself once, so the sticker lands.
  useEffect(() => {
    const id = window.setTimeout(() => setTapped(true), 900);
    return () => window.clearTimeout(id);
  }, []);
  const step = (n: number, title: string, art: React.ReactNode, delay: number) => (
    <div className={cn("mw-sheet px-4 py-3.5", DROP)} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 shrink-0 rounded-full bg-[hsl(var(--mw-brand))] text-[#2E2433] mw-display text-[17px] flex items-center justify-center -rotate-6 shadow-[0_0_0_2.5px_#fff]">
          {n}
        </span>
        <p className="mw-display text-[19px] leading-tight">{title}</p>
      </div>
      <div className="mt-3">{art}</div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      {step(
        1,
        t("mw.how.step1"),
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-[10px] bg-[#2F3460] text-[#FFF6EA] px-3 py-2.5">
            <p className="mw-display text-[17px] leading-tight">{t(`mw.how.q.${door}`)}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[14px] font-semibold">
              <span className="h-8 rounded-[8px] bg-white/10 flex items-center justify-center">{t("common.no")}</span>
              <span className={cn("h-8 rounded-[8px] flex items-center justify-center transition-colors duration-300", tapped ? "bg-[hsl(var(--mw-brand))] text-[#2E2433]" : "bg-white/10")}>
                {t("common.yes")}
              </span>
            </div>
          </div>
          <Glyph kind="right" size={22} className="text-muted-foreground" />
          <span className="mw-cell !w-[46px] !h-[46px] shrink-0" data-mood={tapped ? "bad" : undefined}>
            {tapped && <TopicIcon kind={kind} size={46} sticker className="absolute mw-slap" style={{ ["--r" as string]: "-6deg" }} />}
          </span>
        </div>,
        0,
      )}
      {step(2, t("mw.how.step2"), <MiniMonth kind={kind} hits={HOW_HITS[door]} delay={1400} cell={26} />, 600)}
      {step(
        3,
        t("mw.how.step3"),
        <div className="mw-taped px-3.5 pt-4 pb-3" style={{ ["--tape" as string]: "var(--tape-other)" }}>
          <p className="mw-hand text-[16px] text-muted-foreground">{t("doors.exampleBadge")}</p>
          <p className="mw-display text-[18px] leading-snug">{t(`mw.how.find.${door}`)}</p>
          <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{t("mw.find.seen", { k: 4, n: 5 })}</p>
        </div>,
        1200,
      )}
      {step(4, t("mw.how.step4"), <LimitArt kind={kind} delay={2300} />, 1800)}
    </div>
  );
};

/** Eight squares fill up to the limit; the last one turns it "too much". */
export const LimitArt = ({ kind, delay = 0, max = 8, used = 3 }: { kind: TopicKind; delay?: number; max?: number; used?: number }) => {
  const { t } = useTranslation();
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="mw-cell !rounded-[4px]" data-mood={i < used ? "bad" : undefined}>
            {i < used && (
              <TopicIcon kind={kind} size={26} sticker className="absolute mw-slap" style={{ ["--r" as string]: `${tilt(kind + i)}deg`, animationDelay: `${delay + i * 300}ms` }} />
            )}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold text-muted-foreground">{t("mw.how.limitLine", { n: used, max })}</p>
    </div>
  );
};

/** A hint that unfolds under a link and folds away after "Got it".
 *  Open the first time someone sees it, then closed (one tap to reopen). */
export const Explainer = ({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const { t } = useTranslation();
  const key = `memap_explain_${id}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "seen";
    } catch {
      return false;
    }
  });
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, "seen");
    } catch {
      // stays open next time; harmless
    }
  };
  return (
    <div className={className}>
      <button type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} className="mw-link -ml-2">
        {label}
        <Glyph kind="down" size={18} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn("mt-1 mw-taped px-4 pt-5 pb-4", DROP)} style={{ ["--tape" as string]: "var(--tape-drinking)" }}>
          {children}
          <button type="button" onClick={close} className="mw-btn mw-btn-sm mt-4 w-full">
            {t("mw.explain.gotIt")}
          </button>
        </div>
      )}
    </div>
  );
};

/** How to read the week map, as four tiny squares with one word each. */
export const ReadTheMap = () => {
  const { t } = useTranslation();
  const item = (sq: React.ReactNode, mood: "good" | "bad" | undefined, word: string) => (
    <div className="flex items-center gap-2.5">
      <span className="mw-cell !w-[38px] !h-[38px] shrink-0" data-mood={mood}>{sq}</span>
      <span className="text-[17px] font-semibold leading-tight">{word}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
      {item(<TopicIcon kind="fight" size={40} sticker className="absolute" />, undefined, t("mw.explain.yes"))}
      {item(<PencilCurl size={20} />, undefined, t("mw.explain.no"))}
      {item(null, "good", t("mw.explain.good"))}
      {item(null, "bad", t("mw.explain.bad"))}
      <div className="col-span-2 flex items-center gap-2.5">
        <span className="mw-cell !w-[38px] !h-[38px] shrink-0" data-today="true" />
        <span className="text-[17px] font-semibold leading-tight">{t("mw.explain.tapDay")}</span>
      </div>
    </div>
  );
};
