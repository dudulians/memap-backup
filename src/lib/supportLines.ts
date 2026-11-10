// Where to get help, with no phone numbers typed into MeMap (her note, Nov 9 2026: "я бы не давала точные
// номера… боюсь ошибиться"). Checked Nov 9 2026 (workflow, 4 researchers + a skeptic who re-opened the sources):
// - no store rule or law asks a self-tracking app for helpline numbers: Apple App Store Review Guidelines (Oct 16
//   2026: no "helpline", "crisis" or "suicide" anywhere), Google Play Health apps policy, UK Online Safety Act s.3
//   (user-to-user services only), MHRA software guidance, EU MDCG 2019-11, FDA General Wellness (Jan 2026); for
//   Russia and the UAE nothing was found (searched, not proven);
// - a wrong number is a known risk: 6 of 69 mental-health apps showed a wrong crisis number (Martinengo et al.,
//   BMC Medicine 2019); Samaritans' guidance asks to recheck numbers regularly;
// - so: no numbers and no links (her note, Nov 10 2026: "ссылок не будет, только инструкция"): the sheet says in words
//   that most countries have a free helpline and how to search for one, to talk to someone trusted or a doctor, and
//   "your local emergency number". (Until Nov 10 the afraid-at-home card linked the NO MORE directory.)
// Plan: marketing/research/when-to-act.md ("thoughts of self-harm → country-specific numbers").

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
