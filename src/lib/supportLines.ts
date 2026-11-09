// Where to get help, with no phone numbers typed into MeMap (her note, Nov 9 2026: "я бы не давала точные
// номера… боюсь ошибиться"). Checked Nov 9 2026 (workflow, 4 researchers + a skeptic who re-opened the sources):
// - no store rule or law asks a self-tracking app for helpline numbers: Apple App Store Review Guidelines (Oct 16
//   2026: no "helpline", "crisis" or "suicide" anywhere), Google Play Health apps policy, UK Online Safety Act s.3
//   (user-to-user services only), MHRA software guidance, EU MDCG 2019-11, FDA General Wellness (Jan 2026); for
//   Russia and the UAE nothing was found (searched, not proven);
// - a wrong number is a known risk: 6 of 69 mental-health apps showed a wrong crisis number (Martinengo et al.,
//   BMC Medicine 2019); Samaritans' guidance asks to recheck numbers regularly;
// - so: links to directories the helplines keep up to date, by the phone's time zone (no location asked), and
//   "your local emergency number" in words.
//   talk: no link (her note, Nov 9 2026: "мы можем без него обойтись?"): Find A Helpline's terms forbid
//         referencing it for commercial purposes without written permission, so the sheet says in words that most
//         countries have a free helpline and to talk to someone trusted or a doctor;
//   safe: the NO MORE Global Directory (domestic and sexual violence; made with the UN and the World Bank, checked
//         every quarter, invites sites to add it).
// Plan: marketing/research/when-to-act.md ("thoughts of self-harm → country-specific numbers").

export type HelpLinks = {
  /** free lines for when someone is afraid at home */
  safe: string;
};

const zone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
};

const RUSSIA = /^Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Kirov|Astrakhan|Saratov|Ulyanovsk)|^Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr)/;
const CANADA = /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Iqaluit|Yellowknife|Swift_Current|Creston|Fort_Nelson|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Atikokan|Blanc-Sablon|Dawson_Creek)$/;
const US = /^America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Detroit|Boise|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Menominee|Indiana|Kentucky|North_Dakota)|^Pacific\/Honolulu/;

/** The phone's country by its time zone, when it is clear (ISO code, lower case). */
export const phoneCountry = (): string | null => {
  const tz = zone();
  if (RUSSIA.test(tz)) return "ru";
  if (CANADA.test(tz)) return "ca";
  if (US.test(tz)) return "us";
  if (/^Europe\/(London|Belfast)$/.test(tz)) return "gb";
  if (tz === "Europe/Dublin") return "ie";
  if (tz === "Asia/Dubai") return "ae";
  if (tz === "Europe/Berlin") return "de";
  if (/^Australia\//.test(tz)) return "au";
  return null;
};

/** NO MORE directory pages (checked Nov 9 2026); other countries get the directory's start page. */
const NO_MORE: Record<string, string> = { ru: "russia", ae: "united-arab-emirates", gb: "united-kingdom", us: "usa", de: "germany", ca: "canada", ie: "ireland", au: "australia" };
/** Where the directory has no general line for adults (review, Nov 9 2026: Find A Helpline lists only a women's and
 *  a children's line for the UAE): a line named in words, no number (Gulf News, The National, ExpatWoman: the UAE
 *  National Mental Support Line, run by the National Programme for Happiness and Wellbeing). */
export const talkNoteKey = (): string | null => (phoneCountry() === "ae" ? "support.noteAe" : null);

export const helpLinks = (lang?: string): HelpLinks => {
  const c = phoneCountry();
  void lang;
  return {
    safe: c && NO_MORE[c] ? `https://nomoredirectory.org/${NO_MORE[c]}/` : "https://nomoredirectory.org/",
  };
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

/** Someone writes their own question about being shouted at or hurt by someone close (her note, Nov 9 2026: the two
 *  partner-harm questions are never offered, "только если человек начнёт сам вписывать похожее"). Both a harm
 *  word and a "me / partner" word, so "my child screams at bedtime" doesn't count. */
const HARM_WORDS = /(кри[кч]|(?:^|[^а-яё])(?:на|за|по)?ор(?:[её]т|ал)|повы[сш]\S*\s+(?:на\s+\S+\s+)?голос|голос\S*\s+(?:на\s+\S+\s+)?повы[сш]|оскорб|униж|униз|обзыва|обозв|оби[дж]|гадост|руга|груб|shout|yell(?!ow)|scream|rais\S*\s+(?:\S+\s+)?voice|insult|humiliat|belittl|abus|put\S*\s+me\s+down|call\S*\s+me\s+names|hurtful|hurt\s+me\b|hurt\s+my\s+feelings|mean\s+to\s+me)/i;
const ME_OR_PARTNER = /(меня|мне|партн|муж|(?:^|[^а-яё])жен[аеуыо]|парн|девушк|\bme\b|partner|husband|wife|boyfriend|girlfriend|spouse)/i;
export const writesAboutHomeHarm = (text: string): boolean => HARM_WORDS.test(text) && ME_OR_PARTNER.test(text);

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
