// Questions that mean nearly the same (her decision, Nov 14 2026, after the first-days walk: the hunch offered
// "Feeling drained · new question" beside "Drained after work", Worth watching suggested "Were you exhausted most of
// the day?" to someone asked about being drained after work every evening, and onboarding ticked "Did you drink any
// alcohol?" under her own "Had a glass of wine in the evening?").
// Rule: when one of a group is asked, the app does not offer another as new. A question she typed is read only by a
// few plain words (no AI): it unticks or holds back the library questions those words clearly name. Kept small on
// purpose: only pairs that a person would call the same question.
import type { Tracker } from "@/types/tracker";
import { templateIdOf } from "./answerPhrases";

const GROUPS: string[][] = [
  ["felt-fatigued", "burned-out-after-work", "had-energy"],
  ["drank-alcohol", "alcohol-3-plus"],
  ["smoked", "smoked-hookah"],
  ["felt-angry", "calm-day"],
  ["studied-language", "studied-local-language"],
  ["thought-about-leaving", "thought-divorce"],
  ["cooked-myself", "ordered-delivery"],
  ["compared-on-social", "envied-on-social"],
];

// the start and end of a Russian word (\b does not see Cyrillic)
const RU_A = "(?:^|[^а-яё])", RU_Z = "(?=[^а-яё]|$)";
const OWN_WORDS: [RegExp, string[]][] = [
  [new RegExp(`\\b(wine|beer|vodka|whisk(e)?y|alcohol|cocktails?|tipsy|hangover)\\b|${RU_A}(вин[оаеуы]|пив[оаеу]|водк[аиеуой]|алкогол[ьяюе]|коктейл[ьяеи]|похмель[ея])${RU_Z}|бокал`, "i"), ["drank-alcohol", "alcohol-3-plus"]],
  [new RegExp(`\\b(coffee|espresso|latte|cappuccino|caffeine)\\b|кофе|кофеин|эспрессо|латте|капучино`, "i"), ["coffee-late", "caffeine-4-plus"]],
  [new RegExp(`\\b(smok(e|ed|ing)|cigarettes?|vap(e|ed|ing)|hookah|shisha)\\b|сигарет|вейп|кальян|${RU_A}кур(ил|ила|ю|ит|ение)`, "i"), ["smoked", "smoked-hookah"]],
];

/** The other questions of a library question's group. */
export const twinsOf = (id: string): string[] => GROUPS.find((g) => g.includes(id))?.filter((x) => x !== id) ?? [];

/** Library questions her own words clearly name ("a glass of wine" → the alcohol questions). */
export const namedBy = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const [re, ids] of OWN_WORDS) if (re.test(text)) for (const id of ids) out.add(id);
  return out;
};

/** Library questions her active questions already cover: the twins of the library ones she asks, and the ones her
 *  own questions' words name. The questions she asks themselves are not in it (callers skip those already). */
export const coveredIds = (trackers: Tracker[]): Set<string> => {
  const out = new Set<string>();
  for (const tr of trackers) {
    if (tr.archived) continue;
    const id = templateIdOf(tr);
    if (id) { for (const x of twinsOf(id)) out.add(x); continue; }
    for (const x of namedBy(`${tr.title} ${tr.questionText ?? ""}`)) out.add(x);
  }
  return out;
};
