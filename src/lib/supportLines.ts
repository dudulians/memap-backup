// Where to get help, by the phone's time zone (no location asked). Numbers checked Nov 7 2026:
// - UAE National Mental Support Line 800 4673 (hope.hw.gov.ae; free, Arabic + English; not
//   24/7 and not an emergency service);
// - UK and Ireland: Samaritans 116 123 (free, 24/7);
// - US and Canada: 988 Suicide & Crisis Lifeline (call or text, 24/7);
// - Australia: Lifeline 13 11 14 (24/7);
// - Russia: no federal adult line found; Moscow psychological help 051 (+7 495 051 from a mobile).
// Everywhere else: findahelpline.com lists free lines by country.
// Afraid at home (persona walk, Nov 9 2026; checked Nov 9 2026, 2+ sources each):
// - Russia: Center ANNA all-Russia line 8 800 7000 600 (free; hours given as 9–21 or 24/7);
// - UK: National Domestic Abuse Helpline (Refuge) 0808 2000 247 (free, 24/7);
// - UAE: Dubai Foundation for Women and Children 800 111 (free, 24/7);
// - US: National Domestic Violence Hotline 1-800-799-7233, or text START to 88788 (24/7).
// Plan: marketing/research/when-to-act.md ("thoughts of self-harm → country-specific numbers").

export type SupportLines = {
  emergency: string;
  /** a non-emergency medical line (UK 111) */
  urgent?: string;
  /** a free line to talk to someone */
  talk?: { name: string; nameRu: string; number: string; tel: string };
  /** a free line when someone is afraid at home */
  safe?: { name: string; nameRu: string; number: string; tel: string };
  web: string;
};

const zone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
};

const RUSSIA = /^Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Kirov|Astrakhan|Saratov|Ulyanovsk)|^Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr)/;
const US_CANADA = /^America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Detroit|Boise|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Menominee|Indiana|Kentucky|North_Dakota|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Iqaluit|Yellowknife|Swift_Current|Creston|Fort_Nelson|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Atikokan|Blanc-Sablon|Dawson_Creek)|^Pacific\/Honolulu/;

export const supportLines = (): SupportLines => {
  const tz = zone();
  const web = "https://findahelpline.com";
  if (/^Asia\/(Dubai|Muscat)/.test(tz)) {
    return { emergency: "998 / 999", web, talk: { name: "National Mental Support Line", nameRu: "Национальная линия психологической поддержки", number: "800 4673", tel: "8004673" },
      ...(tz.startsWith("Asia/Dubai") ? { safe: { name: "Dubai Foundation for Women and Children", nameRu: "Фонд защиты женщин и детей, Дубай", number: "800 111", tel: "800111" } } : {}) };
  }
  if (RUSSIA.test(tz)) {
    return { emergency: "112 / 103", web, talk: { name: "Psychological help, Moscow", nameRu: "Психологическая помощь, Москва", number: "+7 495 051", tel: "+7495051" },
      safe: { name: "Center ANNA, all of Russia", nameRu: "Центр «АННА», вся Россия", number: "8 800 7000 600", tel: "88007000600" } };
  }
  if (/^Europe\/(London|Dublin|Belfast)/.test(tz)) {
    return { emergency: "999", urgent: tz.endsWith("Dublin") ? undefined : "111", web, talk: { name: "Samaritans", nameRu: "Samaritans", number: "116 123", tel: "116123" },
      ...(tz.endsWith("Dublin") ? {} : { safe: { name: "National Domestic Abuse Helpline", nameRu: "National Domestic Abuse Helpline", number: "0808 2000 247", tel: "08082000247" } }) };
  }
  if (US_CANADA.test(tz)) {
    const canada = /Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Iqaluit|Yellowknife|Swift_Current|Creston|Fort_Nelson|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Atikokan|Blanc-Sablon/.test(tz);
    return { emergency: "911", web, talk: { name: "988 Suicide & Crisis Lifeline", nameRu: "Линия 988", number: "988", tel: "988" },
      ...(canada ? {} : { safe: { name: "National Domestic Violence Hotline", nameRu: "National Domestic Violence Hotline", number: "1-800-799-7233", tel: "18007997233" } }) };
  }
  if (/^America\//.test(tz)) return { emergency: "911", web };
  if (/^Australia\//.test(tz)) {
    return { emergency: "000", web, talk: { name: "Lifeline", nameRu: "Lifeline", number: "13 11 14", tel: "131114" } };
  }
  return { emergency: "112", web };
};

/** Mood questions whose card offers "Need to talk?". Content review (Nov 9 2026): also the
 *  hard partner, parenting, self-worth, homesick and drinking questions; a partner shouting or
 *  saying hurtful things gets this one too (someone to talk to, the emergency number), since
 *  the red-flag list is about the body. A card has room for one chip: "panic-attack" moved to
 *  "Something worrying?" (bodyTemplates RED_FLAG_IDS), whose sheet shows this free line too.
 *  Never put an id in both sets. */
/** A partner shouting or saying hurtful things: the sheet speaks to that, with a line for when someone
 *  is afraid at home, and the evening doesn't end on "Great work today!" (persona walk, Nov 9 2026). */
export const HOME_HARM_IDS = new Set(["partner-raised-voice", "partner-said-hurtful"]);

export const MOOD_SUPPORT_IDS = new Set([
  "felt-depressed", "lost-interest", "felt-anxious", "felt-lonely",
  "partner-raised-voice", "partner-said-hurtful", "thought-about-leaving", "felt-lonely-with-partner", "thought-divorce",
  "felt-bad-parent", "felt-overwhelmed-parenting",
  "isolated-at-home", "felt-useless", "felt-not-like-others", "cried-today",
  "missed-home-country", "felt-foreigner",
  "drank-alcohol", "alcohol-3-plus",
]);
/** Hard on 12 of the last 14 days → suggest a doctor or therapist (when-to-act.md: PHQ "nearly every day"). */
export const HEAVY_MOOD_IDS = new Set(["felt-depressed", "lost-interest"]);
