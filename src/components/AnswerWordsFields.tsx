// "Your answers in words" (her note, Nov 7 2026: "при добавлении вопроса… нужно добавлять
// и вариации фраз"): for a question she writes herself, how MeMap says her yes and her no
// in links ("No walk → migraine"). Optional; without it the link shows the question with
// its answer. Library questions have theirs already (answerPhrases.ts, answerSentences.ts).
import { useTranslation } from "react-i18next";

export type AnswerWords = { yes?: string; no?: string };

/** Stored in lowercase: a phrase stands in the middle of a line as often as at its start. */
export const cleanWords = (w: AnswerWords): AnswerWords | undefined => {
  const one = (s?: string) => { const x = (s ?? "").trim().replace(/\s+/g, " ").slice(0, 40); return x ? (/^\p{Lu}\p{Lu}/u.test(x) ? x : x[0].toLocaleLowerCase() + x.slice(1)) : undefined; };
  const yes = one(w.yes), no = one(w.no);
  return yes || no ? { ...(yes ? { yes } : {}), ...(no ? { no } : {}) } : undefined;
};

export const AnswerWordsFields = ({ value, onChange }: { value: AnswerWords; onChange: (w: AnswerWords) => void }) => {
  const { t } = useTranslation();
  const field = (k: "yes" | "no") => (
    <label className="flex h-12 items-center gap-2.5 rounded-2xl bg-foreground/[0.06] pl-2 pr-3">
      <span className="flex h-8 min-w-[52px] items-center justify-center rounded-xl bg-background px-2 text-[14px] font-bold">{t(`answerWords.${k}`)}</span>
      <input value={value[k] ?? ""} onChange={(e) => onChange({ ...value, [k]: e.target.value.slice(0, 40) })} placeholder={t(`answerWords.ph${k === "yes" ? "Yes" : "No"}`)}
        aria-label={`${t("answerWords.title")}: ${t(`answerWords.${k}`)}`} className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground" />
    </label>
  );
  const sample = (value.no || value.yes || "").trim();
  return (
    <div>
      <p className="text-[19px] font-semibold">{t("answerWords.title")}</p>
      <div className="mt-3 space-y-2">{field("yes")}{field("no")}</div>
      {sample && <p className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("answerWords.example", { w: sample[0].toLocaleUpperCase() + sample.slice(1) })}</p>}
    </div>
  );
};
