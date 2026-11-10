// Labelled examples in the World's parts while nothing of hers is there yet (her note, Nov 10 2026: "когда
// открываю links, там nothing to show yet. А хочется, чтобы мне показали пример, а что же будет… календарь —
// как эти дни будут заполняться… прям чтобы было четко понятно, что это именно примеры"). Each is drawn
// like the real thing, inside a dashed edge with an "Example" tag on top, and goes once her own data is there.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sprout } from "lucide-react";
import type { Tracker } from "@/types/tracker";
import { findTemplate } from "@/lib/doors";
import { mapPic } from "@/lib/islands";
import { linkCount, linkHead, trackerLookup } from "@/lib/linkText";
import { answerPhrase, cap } from "@/lib/answerPhrases";
import { cardQuestion } from "@/lib/cardText";

/** The dashed frame with its tag and one short line: what hers will look like. */
export const ExampleBox = ({ line, children, kind }: { line: string; children: ReactNode; kind: string }) => {
  const { t } = useTranslation();
  return (
    <section data-example={kind} aria-label={`${t("tour.example")}: ${line}`}
      className="rounded-[22px] border-2 border-dashed border-foreground/20 px-4 pb-4 pt-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full bg-foreground/[0.08] px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("tour.example")}</span>
        <p className="min-w-0 text-[14px] font-semibold leading-snug text-muted-foreground">{line}</p>
      </div>
      {/* the picture is an illustration: nothing in it can be tapped */}
      <div aria-hidden="true" className="pointer-events-none mt-3 select-none">{children}</div>
    </section>
  );
};

/** A library question as a stand-in tracker (the chart example in ChartViews uses it too), so the example speaks in the app's own words in either language. */
export const standIn = (id: string): Tracker | undefined => {
  const f = findTemplate(id);
  if (!f) return undefined;
  const x = f.template;
  return { id: `example-${id}`, title: x.title, questionText: x.questionText, category: x.category, answerType: x.answerType,
    periodDays: x.periodDays, threshold: x.threshold, problemWhen: x.problemWhen, adviceAboveThreshold: x.adviceAboveThreshold,
    createdAt: "2026-01-01T00:00:00.000Z" } as Tracker;
};

const Dots = ({ on, color }: { on: number[]; color: string }) => (
  <div className="flex items-center justify-between">
    {Array.from({ length: 14 }, (_, i) => (
      <span key={i} className="h-3.5 w-3.5 rounded-full" style={{ background: on.includes(i) ? color : "hsl(var(--foreground) / 0.12)" }} />
    ))}
  </div>
);

/** Links: a short night, then a stressful day — told the way a real link is, with its two rows of days. */
export const ExampleLink = () => {
  const { t } = useTranslation();
  const a = standIn("slept-enough"), b = standIn("felt-stressed");
  if (!a || !b) return null;
  const of = trackerLookup([a, b]);
  const r = { first: a.id, second: b.id, firstYes: false, secondYes: true, nextDay: true, k: 4, n: 5, other: { k: 3, n: 20 } };
  const hard = "hsl(var(--strong))";
  return (
    <ExampleBox kind="link" line={t("examples.links")}>
      <p className="text-[19px] font-bold leading-snug tracking-tight">{linkHead(t, r, of)}</p>
      <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{linkCount(t, r)}</p>
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-[14px] font-semibold text-muted-foreground">{cap(answerPhrase(t, a, false))}</p>
          <Dots on={[1, 4, 5, 9, 12]} color={hard} />
        </div>
        <div>
          <p className="mb-1.5 text-[14px] font-semibold text-muted-foreground">{cap(answerPhrase(t, b, true))}</p>
          <Dots on={[2, 5, 6, 10, 11]} color={hard} />
        </div>
      </div>
    </ExampleBox>
  );
};

// a made-up month: hard (rose), calm (green), not answered (pale) — a Monday-first grid with its dates
const MONTH: ("hard" | "calm" | "none")[] = [
  "calm", "calm", "hard", "calm", "calm", "none", "calm",
  "hard", "hard", "calm", "calm", "calm", "calm", "hard",
  "calm", "none", "calm", "hard", "calm", "calm", "calm",
  "calm", "hard", "hard", "calm", "calm", "none", "calm",
  "calm", "calm",
];
const MONDAY = new Date(2024, 0, 1); // a Monday, for the weekday letters

/** My days: how a month fills — dated dots, rose for hard days, green for calm ones. */
export const ExampleMonth = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const wd = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(MONDAY); d.setDate(MONDAY.getDate() + i);
    const s = d.toLocaleDateString(lang, { weekday: lang === "ru-RU" ? "short" : "narrow" }).replace(".", "");
    return s.slice(0, lang === "ru-RU" ? 2 : 1).toUpperCase();
  });
  return (
    <ExampleBox kind="month" line={t("examples.month")}>
      <div className="grid grid-cols-7 gap-y-1.5">
        {wd.map((w, i) => <span key={`w${i}`} className="text-center text-[12px] font-semibold text-muted-foreground">{w}</span>)}
        {MONTH.map((look, i) => (
          <span key={i} className="flex items-center justify-center">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] font-semibold tabular-nums"
              style={{
                background: look === "hard" ? "hsl(var(--strong))" : look === "calm" ? "hsl(var(--balanced) / 0.35)" : "transparent",
                color: look === "hard" ? "hsl(var(--strong-foreground))" : look === "none" ? "hsl(var(--muted-foreground))" : undefined,
              }}>{i + 1}</span>
          </span>
        ))}
      </div>
    </ExampleBox>
  );
};

/** When to act: a rule reached, what it saw and what to do. */
export const ExampleRule = () => {
  const { t } = useTranslation();
  const a = standIn("slept-enough");
  return (
    <ExampleBox kind="rule" line={t("examples.rule")}>
      <div className="surface flex items-start gap-3 rounded-[18px] px-3.5 py-3">
        <img src={mapPic("lighthouse")} alt="" width={22} height={30} className="mt-0.5 shrink-0 drop-shadow-[0_0_6px_hsl(44_96%_60%/0.9)]" />
        <span className="min-w-0">
          <span className="block text-[16px] font-bold leading-snug">{a ? cardQuestion(a) : ""}</span>
          <span className="mt-0.5 block text-[14px] font-semibold text-muted-foreground">{t("examples.ruleSaw")}</span>
          <span className="mt-1.5 block text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("examples.rulePlan")}</span>
        </span>
      </div>
    </ExampleBox>
  );
};

/** What helps: a change being tried, its day and how the days went. */
export const ExampleTest = () => {
  const { t } = useTranslation();
  return (
    <ExampleBox kind="test" line={t("examples.test")}>
      <div className="surface flex items-start gap-3 rounded-[18px] px-3.5 py-3">
        <span className="icon-dot h-10 w-10 shrink-0"><Sprout className="h-5 w-5" strokeWidth={2.4} /></span>
        <span className="min-w-0">
          <span className="block text-[16px] font-bold leading-snug">{t("examples.testName")}</span>
          <span className="mt-0.5 block text-[14px] font-semibold text-[hsl(var(--coin-teal))]">{t("world4.testDay", { k: 9, count: 14 })}</span>
          <span className="mt-0.5 block text-[14px] font-semibold text-muted-foreground">{t("examples.testSo")}</span>
        </span>
      </div>
    </ExampleBox>
  );
};
