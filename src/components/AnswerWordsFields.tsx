// "Your answers in words" (her note, Nov 7 2026: "при добавлении вопроса… нужно добавлять
// и вариации фраз"): for a question she writes herself, how MeMap says her yes and her no
// in links ("No walk → migraine"). Optional; without it the link shows the question with
// its answer. Library questions have theirs already (answerPhrases.ts, answerSentences.ts).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PenLine } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { templateIdOf } from "@/lib/answerPhrases";
import { getTrackers, saveTrackers } from "@/lib/storage";
import type { Tracker } from "@/types/tracker";

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
      {sample && <p className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("answerWords.example", { w: sample })}</p>}
    </div>
  );
};

/** Her own questions that read clumsily in a link ("On days you answer “yes” to “Did my husband annoy me or not”").
 *  The app can't rewrite free text without AI, so she says it herself, once, where she sees why (Nov 11 2026, her
 *  worry about questions like «муж меня бесил или нет»): under a link with such a question, "Say … in your own
 *  words" opens the two short fields; saved on the question, every link with it reads her way. */
export const needsWords = (tr: Tracker | undefined): tr is Tracker => !!tr && !templateIdOf(tr) && !tr.words?.yes && !tr.words?.no;
export const OwnWordsPrompt = ({ tracker }: { tracker: Tracker }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState<AnswerWords>({});
  const [saved, setSaved] = useState(false);
  if (saved || !needsWords(tracker)) return null;
  if (!open) {
    return (
      <button type="button" data-own-words={tracker.id} onClick={() => { haptics.tap(); track("own_words_opened"); setOpen(true); }}
        className="mt-3 flex min-h-[44px] items-center gap-2 text-left text-[15px] font-bold text-[hsl(var(--coin-teal))]">
        <PenLine className="h-4 w-4 shrink-0" strokeWidth={2.6} />{t("answerWords.prompt", { q: tracker.title })}
      </button>
    );
  }
  const clean = cleanWords(words);
  const save = async () => {
    if (!clean) return;
    haptics.success();
    const all = await getTrackers();
    await saveTrackers(all.map((x) => (x.id === tracker.id ? { ...x, words: clean } : x)));
    track("own_words_saved", { yes: !!clean.yes, no: !!clean.no });
    setSaved(true);
  };
  return (
    <div data-own-words-open className="mt-3 rounded-[18px] bg-foreground/[0.035] p-3">
      <AnswerWordsFields value={words} onChange={setWords} />
      <button type="button" disabled={!clean} onClick={() => void save()} className="raised-btn is-small mt-3 w-full justify-center disabled:opacity-50">{t("answerWords.save")}</button>
    </div>
  );
};
