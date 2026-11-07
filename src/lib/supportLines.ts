// Where to get help, by the phone's time zone (no location asked). Numbers checked Nov 7 2026:
// - UAE National Mental Support Line 800 4673 (hope.hw.gov.ae; free, Arabic + English; not
//   24/7 and not an emergency service);
// - UK and Ireland: Samaritans 116 123 (free, 24/7);
// - US and Canada: 988 Suicide & Crisis Lifeline (call or text, 24/7);
// - Australia: Lifeline 13 11 14 (24/7);
// - Russia: no federal adult line found; Moscow psychological help 051 (+7 495 051 from a mobile).
// Everywhere else: findahelpline.com lists free lines by country.
// Plan: marketing/research/when-to-act.md ("thoughts of self-harm → country-specific numbers").

export type SupportLines = {
  emergency: string;
  /** a non-emergency medical line (UK 111) */
  urgent?: string;
  /** a free line to talk to someone */
  talk?: { name: string; nameRu: string; number: string; tel: string };
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
    return { emergency: "998 / 999", web, talk: { name: "National Mental Support Line", nameRu: "Национальная линия психологической поддержки", number: "800 4673", tel: "8004673" } };
  }
  if (RUSSIA.test(tz)) {
    return { emergency: "112 / 103", web, talk: { name: "Psychological help, Moscow", nameRu: "Психологическая помощь, Москва", number: "+7 495 051", tel: "+7495051" } };
  }
  if (/^Europe\/(London|Dublin|Belfast)/.test(tz)) {
    return { emergency: "999", urgent: tz.endsWith("Dublin") ? undefined : "111", web, talk: { name: "Samaritans", nameRu: "Samaritans", number: "116 123", tel: "116123" } };
  }
  if (US_CANADA.test(tz)) {
    return { emergency: "911", web, talk: { name: "988 Suicide & Crisis Lifeline", nameRu: "Линия 988", number: "988", tel: "988" } };
  }
  if (/^America\//.test(tz)) return { emergency: "911", web };
  if (/^Australia\//.test(tz)) {
    return { emergency: "000", web, talk: { name: "Lifeline", nameRu: "Lifeline", number: "13 11 14", tel: "131114" } };
  }
  return { emergency: "112", web };
};

/** Mood questions whose card offers "Need to talk?". */
export const MOOD_SUPPORT_IDS = new Set(["felt-depressed", "lost-interest", "felt-anxious", "panic-attack", "felt-lonely"]);
/** Hard on 12 of the last 14 days → suggest a doctor or therapist (when-to-act.md: PHQ "nearly every day"). */
export const HEAVY_MOOD_IDS = new Set(["felt-depressed", "lost-interest"]);
