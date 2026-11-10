// "Test one change" (Nov 2 2026; her ideas for progress: "провёл эксперимент —
// появился сад"). She picks one small change for an island and tries it for
// a week; MeMap asks "Did you…?" with that island's questions, then shows how
// her hard days went on days with the change and without. Counts only,
// never a promise that the change works. A finished test grows a garden on
// that island (src/lib/growth.ts). Stored on the phone like everything else.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { getDoorState, isoLocal } from "@/lib/doors";
import { isHardAnswer, isNeutralQuestion, isTestQuestion, islandOf } from "@/lib/islands";
import { track } from "@/lib/analytics";
import { HOME_HARM_IDS } from "@/lib/supportLines";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";

/** Two weeks (Nov 6 2026, board 68: week 4 "what helps" compares before and during). */
export const EXPERIMENT_DAYS = 14;
const KEY = "memap_experiments";

export interface Experiment {
  id: string;
  /** the island it is for */
  island: string;
  /** the "Did you…?" question it added */
  trackerId: string;
  /** what she tries, in her words */
  change: string;
  /** first day */
  start: string;
  /** when she looked at the result (then it is over) */
  reviewed?: string;
  /** keep asking the question after the week */
  kept?: boolean;
  /** the action point it came from ("I'll try", Nov 5 2026): that question's id */
  from?: string;
  /** "HH:MM": a daily reminder until the try ends (board 65, Nov 6 2026) */
  remind?: string;
  /** a weekly goal for the question itself ("3 workouts a week", Nov 8 2026): no new
   *  question, the test watches the one she has (trackerId) */
  same?: boolean;
  /** the goal a week, for "This week: 2 of 3" */
  perWeek?: number;
  /** the step happens at bedtime or at night: its question is about last night, from the second evening (Nov 10 2026) */
  night?: boolean;
  /** "HH:MM" she gets up (a bedtime test counts back from it: "In bed by 23:00") */
  wake?: string;
  /** the answer that means the step was done: "no" when the test watches a hard question ("Smoked hookah?" — no) */
  doneWhen?: boolean;
}
/** The step was done on this answer. */
export const doneBy = (x: Pick<Experiment, "doneWhen">, value: unknown): boolean => value === (x.doneWhen ?? true);

/** Steps that happen after the evening check-in, at bedtime or at night (her note, Nov 10 2026: a bedtime test asked
 *  "Did you set a reminder to go to bed…?" every evening — "вопрос на след день в карточках"). Their question is about
 *  last night and comes from the test's second evening; the evening before, the push and the Done card say tonight's
 *  step. */
export const NIGHT_IDEAS = new Set<string>([
  "bed23", "phoneAway", "noSocialBed", "worryList", "sameWake", "sameSleepTimes", "sideSleep", "noDrinksBed2h", "coolBedroom", "relaxJaw", "antiperspirantNight", "softSound", "earplugs", "alarmClock", "chargeOutside", "readInstead", "dimLights", "gamesStopBed", "lightLate", "postStay", "bed8h", "nightAwakeUp", "windDown30", "fallAsleepUp",
]);
/** A plan whose habit is just the good answer of its own question ("Go to bed 8 hours before you get up" for "Did you sleep
 *  7+ hours last night?"): the test watches that question, no second one is added ("если его ещё не было", Nov 10 2026). */
export const WATCH_IDEAS: Record<string, string[]> = {
  warmMoment: ["felt-close-to-partner"], kindStranger: ["complimented-stranger"], bed8h: ["slept-enough"], stretchShower: ["stretched"], morningLight: ["saw-daylight"], pillsWithHabit: ["took-meds"], sameWake: ["same-wake-time"], squeezeBrushing: ["pelvic-floor-exercises"], hookahWeekdays: ["smoked-hookah"], dayCap: ["stayed-on-budget"], cookOne: ["cooked-myself"], vegNeverSkip: ["ate-vegetables"], workEndFixed: ["worked-overtime"], petWhenNear: ["petted-an-animal"], talkOutLoud: ["talked-to-pet"], meditate5: ["meditated"], learn15: ["studied-language","practiced-skill"], episodeOnTheGo: ["listened-podcast"], askLocal: ["spoke-local-language"], localLang15: ["studied-local-language"], kidOutside30: ["child-physical-activity"],
};
/** Tests that count bedtime back from the wake-up time: hours in bed. */
export const BED_FROM_WAKE: Record<string, number> = { bed8h: 8 };
const hhmm = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
/** "23:00" from a 07:00 wake-up and 8 hours in bed. */
export const bedtimeFrom = (wake: string, hours: number) => hhmm(minutes(wake) - hours * 60);
/** Half an hour before bedtime: the push that says tonight's step. */
export const beforeBed = (bed: string) => hhmm(minutes(bed) - 30);
/** Save the wake-up time a bedtime test counts back from. */
export const setExperimentWake = (id: string, wake: string) => save(getExperiments().map((x) => (x.id === id ? { ...x, wake } : x)));

/** A time that fits the change (board 65): bedtime ones in the evening, morning ones early. Her own
 *  plan too, by its words (Nov 8 2026: "Go to bed by 23:00" came at 9:00 in the morning). */
export const smartRemindTime = (idea: string | null, text = ""): string => {
  const at: Record<string, string> = { bed23: "21:30", phoneAway: "21:00", noNewsEvening: "18:30", noMailEvening: "19:00", stop19: "18:30", noSweetsEvening: "19:30",
    noCoffee14: "13:30", water: "10:00", lunchBreak: "12:30", walk20: "08:00", outsideMorning: "08:00", stretch: "08:00", screenFreeHour: "18:00", bedtimeSame: "19:00",
    threeLines: "20:30", talkNoPhones: "19:00", thankYou: "18:00", walkTogether: "17:30", playTogether: "17:30", extraWalk: "17:00", playTime: "18:00",
    sameFoodTime: "08:00", callParents: "18:00", visitWeekend: "18:00", shortMessage: "12:00", nauseaLog: "12:00",
    socialLimit: "12:00", noSocialMorning: "07:30", noSocialBed: "21:30", gladLine: "20:30", noPhoneMorning: "07:30", screenBreaks: "10:00", newsOnce: "09:00", sameWake: "21:30", worryList: "21:00", coffeeTwo: "11:00", regularMeals: "08:00", dinnerEarly: "18:30", vegOne: "12:00", noAlcohol: "18:00", drinkLimit: "17:30", urgeNote: "12:00", delayTen: "10:00", waitDay: "12:00", spendLog: "20:30", noShopApps: "19:30", moveBreak: "10:00", symptomNote: "20:00", foodLog: "20:00", breathe: "13:00", smallJoy: "17:00", angerNote: "12:00", myTime: "17:00", doneList: "20:30", textFriend: "13:00", callOne: "18:00", outAmongPeople: "16:00", noPhoneMeal: "18:30", focusFirst: "08:30", oneThing: "20:00", learn15: "18:00", read10: "19:00", hobby20: "18:00", pauseYes: "09:00", tidy10: "18:00", askLocal: "11:00",
    // a question's own changes (Nov 9 2026, QUESTION_IDEAS)
    pauseHeated: "18:00", sayHurt: "18:00", handTask: "17:00", askPartnerDay: "19:00", warnFive: "16:00", askChildDay: "18:00", readTogether: "19:30", handChildTask: "10:00", askHelp: "10:00", tableMeal: "18:00", kidMealTimes: "08:00", newFoodNext: "12:00", kidOutside30: "16:00", walkPartWay: "08:00", washHands: "16:00", airRoom: "19:30",
    pauseSorry: "10:00", sorryThanks: "12:00", thankByName: "12:00", kindStranger: "12:00", sweatWorkout: "17:30", strength10: "17:30", kettleSquats: "08:00", warmPad: "20:00", sameCoffee: "09:00", sameSleepTimes: "21:30", sideSleep: "21:30", noAlcoholBed: "18:00", drinkFreeDays: "17:30", coffeeLess: "11:00", waterWaking: "07:30", waterMeals: "12:00", bottleNear: "09:00",
    breakfast2h: "08:00", lunchBy1: "12:00", breakfastReady: "20:00", snackBag: "08:00", moisturize: "08:00", warmShower: "20:00", noFragrance: "08:00", fruitVegMeals: "08:00", toiletAfterBreakfast: "08:00", noStrain: "08:00", smallDinner: "18:30", noDrinksBed2h: "19:30", pelvicSqueeze3: "09:00", urgeWaitMinute: "10:00", noHoldPee: "10:00",
    coolBedroom: "21:00", layers: "08:00", dressWarm: "08:00", gloves: "08:00", sameSkincare: "08:00", noPicking: "10:00", standSlowly: "08:00", relaxJaw: "21:30", squeezeBrushing: "08:00", antiperspirantNight: "21:30", looseCotton: "08:00", softSound: "21:30", supportBra: "08:00",
    stopAtTwo: "17:30", waterBetween: "17:30", decafOne: "11:00", decafAfternoon: "13:30", halfCupStep: "09:00", noSmokeEvening: "19:30", smokeFreeFirstHour: "07:00", hookahFreeMeet: "16:00", noHookah: "18:00", dinnerBy7: "18:00", realLunch: "12:30", lightLate: "20:00", sweetsAway: "10:00", fruitDessert: "13:00", sweetsAfterMeal: "12:00",
    cookOne: "17:30", lunchFromHome: "08:00", alarmClock: "21:30", gameTimer: "18:00", gamesStopBed: "21:00", gamesAfterTasks: "17:00", noExCheck: "20:00", friendInstead: "20:00", postNoCheck: "12:00", postStay: "20:00", noProfileDay: "20:00", waitScreenshot: "12:00", writeInstead: "20:00", cookDouble: "17:30", dinnerByLunch: "11:30", pickDinner: "20:00",
    sitToEat: "12:00", snackPlate: "15:00", plannedSnack: "14:00", weeklyAmount: "19:00", doItYourself: "10:00", chargeOutside: "21:00", readInstead: "21:30", dimLights: "21:00", walkAfterMeals: "12:30", fruitSnack: "15:00", vegReady: "18:00", halfPlateVeg: "12:00", clothesReady: "20:30", clearSurface: "18:00", dishesNow: "19:00",
    funny10: "19:00", funnyPerson: "17:00", songMove: "18:00", animalWalk: "17:00", likeLook: "20:30", worryTime: "18:00", smallNo: "10:00", waitReply: "09:00", caredTask: "09:00", workWin: "17:30", balanceOnce: "19:00", make15: "18:00", words5: "18:00", decisionLines: "20:30",
    calmWalks: "08:00", noTreats: "18:00", petFoodLog: "20:00", petEveningPlay: "19:00", petEarlyMeal: "18:00", parentWater: "11:00", parentRoutine: "09:00", parentTalk15: "18:00", parentMeal: "12:30", parentSnacks: "10:00", parentDaylight: "09:00", parentNoLateNap: "14:30", nightLight: "20:00", parentShoes: "09:00", pillCheck: "09:00", askPain: "18:00",
    wellDone: "20:30", kindPerson: "17:00", muteChat: "18:30", kidsMessage: "12:00", kidsShare: "18:00", billsSameDay: "19:00", messageHome: "13:00", localThing: "16:00", cookHome: "17:30", localDish: "12:30", localProduct: "11:00", daylight20: "11:00", homeSounds: "20:00", localChat: "12:00", messageExpat: "13:00", goodHardHere: "20:30",
    earplugs: "21:30", leaveEarly15: "07:30", easyTimeOut: "07:30", localLang15: "18:00", localListen10: "18:00",
    // each daily library plan's own step (Nov 10 2026)
    warmMoment: "18:00", partnerTriggerNote: "12:00", flirtAfterFeel: "12:00", kidTime15: "17:30", nauseaNote: "09:00", bed8h: "21:00", nightAwakeUp: "21:30", stretchShower: "08:00", walkingCall: "09:00", morningLight: "07:30", bottleTwice: "09:00", windDown30: "21:30", pillsWithHabit: "08:00", napShort: "12:30", fallAsleepUp: "21:30", warmBodyGloves: "08:00", hookahWeekdays: "16:00", coffeeByNoon: "11:00", gamesHourDay: "17:00", dayCap: "08:00", saleFullPrice: "10:00", walkAfterLunch: "12:00", vegNeverSkip: "08:00", angerMissing: "12:00", workBotherNote: "17:30", workEndFixed: "17:00", mainThingFirst: "08:30", smallPromise: "07:30", smallStart: "09:00", petWhenNear: "10:00", talkOutLoud: "10:00", bossNote: "12:00", drainWho: "12:00", waitHourNews: "09:00", meditate5: "08:00", goodThingEvening: "19:00", notifOffHour: "09:00", episodeOnTheGo: "08:00", noiseTimes: "12:00", paperworkTreat: "09:00", petSameRoutine: "08:00", petPlayMore: "18:00", badNightNote: "08:00", screenFreeActivity: "16:00", brightMomentNote: "18:00", bedtimeRoutineEarly: "18:30" };
  if (idea && at[idea]) return at[idea];
  const s = text.toLowerCase();
  // eating or drinking hours before bed: early evening; anything else about bed: an hour before it
  if (/(d|two|three) hours before bed|за [2-9] час|finish eating|dinner|drinks|ужин|заканчивать есть|ничего не пить/.test(s)) return "18:30";
  if (/bed|sleep|night|asleep|сна|спать|сон|ночь|кроват|отбой|wind(ing)? down|укладыв/.test(s)) return "21:00";
  if (/morning|breakfast|wake|утр|завтрак|подъ[её]м/.test(s)) return "08:00";
  if (/lunch|обед/.test(s)) return "12:00";
  if (/coffee|caffeine|кофе/.test(s)) return "13:30";
  if (/evening|вечер/.test(s)) return "19:00";
  if (/work|работ/.test(s)) return "17:30";
  return "10:00";
};
/** Once (Nov 8 2026): tests that got the old 9:00 default move to a time that fits them. */
export const fixDefaultReminders = (fit: (x: Experiment) => string) => {
  try {
    if (localStorage.getItem("memap_try_time_fixed")) return;
    localStorage.setItem("memap_try_time_fixed", "1");
    const list = getExperiments();
    if (!list.some((x) => !x.reviewed && x.remind === "09:00")) return;
    save(list.map((x) => (!x.reviewed && x.remind === "09:00" ? { ...x, remind: fit(x) } : x)));
  } catch { /* stays as it was */ }
};
/** Turn the try's daily reminder on (a time) or off (null). */
export const setExperimentRemind = (id: string, time: string | null) => {
  save(getExperiments().map((x) => (x.id === id ? (time ? { ...x, remind: time } : (({ remind: _r, ...rest }) => rest)(x)) : x)));
};

/** Ready ideas per island (keys into experiment.idea.*): everyday changes,
 *  hers to choose; MeMap only counts what happens. */
export const IDEAS: Record<string, string[]> = {
  me: ["outsideMorning", "phoneAway", "threeLines"],
  love: ["talkNoPhones", "thankYou", "walkTogether"],
  kids: ["screenFreeHour", "playTogether", "bedtimeSame"],
  health: ["bed23", "noCoffee14", "water"],
  body: ["walk20", "stretch", "noSweetsEvening"],
  pet: ["extraWalk", "playTime", "sameFoodTime"],
  parents: ["callParents", "visitWeekend", "shortMessage"],
  work: ["stop19", "lunchBreak", "noMailEvening"],
  world: ["noNewsEvening", "outsideMorning", "walk20"],
  mine: ["walk20", "bed23", "phoneAway"],
  other: ["walk20", "bed23", "phoneAway"],
};
export const ideasFor = (island: string): string[] => IDEAS[island] ?? IDEAS.other;
/** Plans with their own test words (a question and today's line) that aren't island ideas (Nov 8 2026). */
export const PLAN_IDEAS = ["nauseaLog", "warmMoment", "partnerTriggerNote", "flirtAfterFeel", "kidTime15", "nauseaNote", "bed8h", "nightAwakeUp", "stretchShower", "walkingCall", "morningLight", "bottleTwice", "windDown30", "pillsWithHabit", "napShort", "fallAsleepUp", "warmBodyGloves", "hookahWeekdays", "coffeeByNoon", "gamesHourDay", "dayCap", "saleFullPrice", "walkAfterLunch", "vegNeverSkip", "angerMissing", "workBotherNote", "workEndFixed", "mainThingFirst", "smallPromise", "smallStart", "petWhenNear", "talkOutLoud", "bossNote", "drainWho", "waitHourNews", "meditate5", "goodThingEvening", "notifOffHour", "episodeOnTheGo", "noiseTimes", "paperworkTreat", "petSameRoutine", "petPlayMore", "badNightNote", "screenFreeActivity", "brightMomentNote", "bedtimeRoutineEarly"];
/** Ideas no longer offered (content review, Nov 9 2026), kept so the tests already running keep their
 *  name, question and reminder: "No alcohol for two weeks" (a sudden stop is unsafe for someone who
 *  drinks every day → drinkFreeDays), "No more than 2 coffees" (halving at once gives withdrawal
 *  headaches → coffeeLess), "Note how you feel" (the evening answers already are that diary). */
export const OLD_IDEAS = ["noAlcohol", "coffeeTwo", "symptomNote", "sayHurt"];
/** Changes on a question's own topic (her note, Nov 9 2026: "Not for me" on comparing oneself online
 *  offered sweets and stretching). Which question has which topic: src/lib/topicIdeas.ts. A question
 *  with its own list in QUESTION_IDEAS uses that instead. */
export const TOPIC_IDEAS: Record<string, string[]> = {
  social: ["socialLimit", "noSocialMorning", "noSocialBed", "gladLine"],
  screens: ["phoneAway", "noPhoneMorning", "socialLimit", "screenBreaks"],
  news: ["newsOnce", "noNewsEvening", "noPhoneMorning"],
  sleep: ["bed23", "phoneAway", "sameWake", "worryList", "noCoffee14"],
  caffeine: ["coffeeLess", "noCoffee14", "decafOne"],
  food: ["regularMeals", "dinnerEarly", "vegOne", "noSweetsEvening", "water"],
  alcohol: ["drinkFreeDays", "drinkLimit", "urgeNote"],
  smoking: ["delayTen", "noSmokeEvening", "smokeFreeFirstHour", "urgeNote"],
  money: ["waitDay", "spendLog", "noShopApps"],
  movement: ["walk20", "stretch", "outsideMorning", "moveBreak"],
  pain: ["moveBreak", "stretch", "walk20"],
  headache: ["sameCoffee", "regularMeals", "sameSleepTimes", "walk20", "water"],
  digestion: ["foodLog", "regularMeals", "dinnerEarly", "water"],
  nausea: ["nauseaLog", "foodLog", "regularMeals"],
  // every body question has its own list (QUESTION_IDEAS): a symptom has its own levers
  body: [],
  eyes: ["screenBreaks", "phoneAway"],
  energy: ["bed23", "outsideMorning", "regularMeals", "walk20"],
  calm: ["breathe", "walk20", "outsideMorning", "threeLines"],
  mood: ["smallJoy", "outsideMorning", "textFriend", "threeLines"],
  joy: ["smallJoy", "gladLine", "outsideMorning"],
  anger: ["breathe", "angerNote", "myTime"],
  selfworth: ["doneList", "gladLine", "smallJoy"],
  rest: ["myTime", "smallJoy", "hobby20"],
  lonely: ["textFriend", "callOne", "outAmongPeople"],
  partner: ["talkNoPhones", "thankYou", "walkTogether", "noPhoneMeal"],
  past: ["threeLines", "textFriend", "noSocialBed"],
  kids: ["playTogether", "screenFreeHour", "bedtimeSame"],
  parenting: ["myTime", "breathe", "playTogether"],
  pet: ["extraWalk", "playTime", "sameFoodTime"],
  parents: ["callParents", "visitWeekend", "shortMessage"],
  work: ["stop19", "lunchBreak", "noMailEvening", "oneThing"],
  focus: ["focusFirst", "oneThing", "screenBreaks"],
  workpeople: ["lunchBreak", "breathe", "threeLines"],
  boundaries: ["pauseYes", "myTime", "threeLines"],
  habits: ["sameWake", "oneThing", "noPhoneMorning"],
  growth: ["learn15", "read10", "hobby20"],
  decisions: ["decisionLines"],
  home: ["tidy10", "clearSurface", "dishesNow"],
  expat: ["callOne", "outAmongPeople", "threeLines"],
  language: ["localLang15", "askLocal"],
};

/** Changes for one library question (template id → idea keys), ahead of its topic's list (content
 *  review, Nov 9 2026: all 14 partner questions had the same 4 ideas, "Partner raised their voice" got
 *  "Say thank you", "Pet limped" got "an extra walk"). Each fits that question and a real person who
 *  answered it that way; a daily habit for two weeks, never a once-action (those are plans). An empty
 *  list on purpose: no 2-week habit changes it (a cold, a heavy period day), only "write your own". */
export const QUESTION_IDEAS: Record<string, string[]> = {
  // love: partner
  "argued-with-partner": ["pauseHeated", "talkNoPhones", "thankYou", "walkTogether"],
  "felt-lonely-with-partner": ["askPartnerDay", "talkNoPhones", "walkTogether", "noPhoneMeal"],
  // none on purpose (Nov 9 2026): a test here would compare the partner's days with the person's habit
  "partner-raised-voice": [],
  "partner-said-hurtful": [],
  "unfair-chores": ["handTask", "talkNoPhones"],
  flirted: ["talkNoPhones"],
  "thought-about-someone-else": ["talkNoPhones"],
  // love: others
  "called-parent": ["shortMessage", "visitWeekend"],
  "apologized-first": ["pauseSorry", "sorryThanks", "doneList"],
  "complimented-stranger": ["thankByName", "kindStranger", "outAmongPeople"],
  // kids
  "quality-time-kid": ["playTogether", "askChildDay", "readTogether"],
  "got-help-with-kids": ["handChildTask", "askHelp", "myTime"],
  "child-refused-food": ["tableMeal", "kidMealTimes", "newFoodNext"],
  "child-physical-activity": ["playTogether", "kidOutside30", "walkPartWay"],
  "child-sick-symptoms": ["washHands", "airRoom", "bedtimeSame"],
  "child-meltdown": ["warnFive", "bedtimeSame", "screenFreeHour", "playTogether"],
  // health: movement
  "trained-hard": ["sweatWorkout", "walk20"],
  "strength-training": ["strength10", "kettleSquats"],
  stretched: ["moveBreak", "walk20"],
  "walked-a-lot": ["walkPartWay", "walkAfterMeals"],
  // health: sleep
  "snored-or-gasped": ["sideSleep", "noAlcoholBed"],
  "sleep-aid": ["bed23", "sameWake", "worryList"],
  "same-wake-time": ["bed23", "phoneAway", "worryList", "noCoffee14"],
  // health: food and water
  "drank-water": ["waterWaking", "waterMeals", "bottleNear"],
  "ate-by-2pm": ["breakfast2h", "lunchBy1", "breakfastReady", "regularMeals"],
  "skipped-meal": ["regularMeals", "snackBag", "lunchBy1"],
  // health: body
  "period-symptoms": ["walk20", "warmPad", "regularMeals"],
  "pms-signs": ["walk20", "bed23", "regularMeals"],
  "skin-allergy": ["moisturize", "warmShower", "noFragrance"],
  "heart-palpitations": ["coffeeLess", "drinkFreeDays", "breathe"],
  "bladder-leak": ["pelvicSqueeze3", "coffeeLess"],
  "bladder-urgency": ["coffeeLess", "urgeWaitMinute"],
  "pee-burning": ["water", "noHoldPee"],
  "night-pee-2-plus": ["noDrinksBed2h", "noAlcoholBed", "noCoffee14"],
  "pelvic-floor-exercises": ["squeezeBrushing", "pelvicSqueeze3"],
  "hot-flushes": ["coolBedroom", "noAlcoholBed", "layers"],
  "night-sweats": ["coolBedroom", "noAlcoholBed", "layers"],
  breakout: ["sameSkincare", "noPicking", "bed23"],
  dizzy: ["water", "regularMeals", "standSlowly"],
  "sweated-a-lot": ["antiperspirantNight", "looseCotton"],
  "tinnitus-louder": ["softSound", "bed23", "noCoffee14"],
  "breast-tender": ["supportBra"],
  "fingers-white-cold": ["gloves", "dressWarm"],
  "sick-day": [],
  "heavy-flow-day": [],
  "morning-libido": [],
  // health: pain and digestion
  "jaw-sore-morning": ["noAlcoholBed", "noCoffee14", "relaxJaw"],
  "pooped-today": ["fruitVegMeals", "walk20", "toiletAfterBreakfast", "water"],
  "hard-to-poop": ["fruitVegMeals", "walk20", "toiletAfterBreakfast", "water"],
  "piles-bothered": ["fruitVegMeals", "noStrain", "walk20", "water"],
  heartburn: ["dinnerEarly", "noAlcoholBed", "smallDinner", "foodLog"],
  bloated: ["foodLog", "regularMeals", "drinkFreeDays", "walk20"],
  "loose-stool": ["foodLog", "regularMeals", "drinkFreeDays", "walk20"],
  // body & habits
  "alcohol-3-plus": ["stopAtTwo", "waterBetween", "drinkFreeDays", "drinkLimit"],
  "caffeine-4-plus": ["coffeeLess", "decafOne", "noCoffee14"],
  "coffee-late": ["decafAfternoon", "noCoffee14"],
  "less-caffeine-than-usual": ["sameCoffee", "halfCupStep"],
  "smoked-hookah": ["hookahFreeMeet", "noHookah"],
  "ate-late": ["dinnerBy7", "realLunch", "lightLate", "regularMeals"],
  "ate-sweets": ["sweetsAway", "fruitDessert", "sweetsAfterMeal", "regularMeals"],
  "ate-fast-food": ["cookOne", "snackBag", "lunchFromHome"],
  "ordered-delivery": ["cookOne", "cookDouble", "dinnerByLunch"],
  "cooked-myself": ["pickDinner", "cookDouble"],
  "ate-by-fridge": ["sitToEat", "snackPlate", "plannedSnack"],
  "ate-vegetables": ["fruitSnack", "vegReady", "halfPlateVeg"],
  "paid-to-skip-effort": ["weeklyAmount", "doItYourself"],
  "phone-free-morning": ["alarmClock", "chargeOutside", "noPhoneMorning", "phoneAway"],
  "screens-before-bed": ["chargeOutside", "readInstead", "dimLights"],
  "gaming-streams-2h": ["gameTimer", "gamesStopBed", "gamesAfterTasks"],
  "stalked-ex": ["noExCheck", "friendInstead"],
  "rewatched-stories": ["noProfileDay", "friendInstead", "socialLimit"],
  "deleted-own-post": ["postNoCheck", "postStay"],
  "screenshotted-chat": ["waitScreenshot", "writeInstead", "textFriend"],
  "wore-same-shirt": ["clothesReady", "smallJoy", "outsideMorning", "textFriend"],
  // me: mind and mood
  "felt-anxious": ["worryTime", "breathe", "walk20", "outsideMorning"],
  meditated: ["walk20", "outsideMorning"],
  "heard-bad-news": ["newsOnce", "noNewsEvening", "breathe", "walk20"],
  "felt-grateful": ["smallJoy", "outsideMorning"],
  "laughed-uncontrollably": ["funny10", "funnyPerson"],
  "danced-or-sang-alone": ["songMove"],
  "petted-an-animal": ["animalWalk"],
  "liked-my-selfie": ["likeLook"],
  "said-yes-when-meant-no": ["smallNo", "waitReply", "pauseYes"],
  "criticized-by-close": ["wellDone", "kindPerson", "myTime"],
  "toxic-friend": ["kindPerson", "muteChat", "myTime"],
  "kids-reached-out": ["kidsMessage", "kidsShare", "callOne"],
  "did-creative-work": ["make15", "hobby20"],
  "studied-language": ["words5", "learn15"],
  // work and money
  "felt-fulfilled-at-work": ["caredTask", "workWin"],
  "money-worry": ["balanceOnce", "spendLog"],
  "financial-issue": ["balanceOnce", "billsSameDay", "spendLog"],
  // pet
  "pet-limped": ["calmWalks"],
  "pet-skipped-food": ["sameFoodTime", "noTreats", "petFoodLog"],
  "pet-stomach-upset": ["sameFoodTime", "noTreats"],
  "pet-restless-night": ["petEveningPlay", "petEarlyMeal"],
  // parents
  "parent-confused": ["parentWater", "parentRoutine", "parentTalk15"],
  "parent-skipped-meal": ["parentMeal", "parentSnacks"],
  "parent-slept-poorly": ["parentDaylight", "parentNoLateNap"],
  "parent-stumbled": ["nightLight", "parentShoes"],
  "parent-took-meds": ["pillCheck", "callParents"],
  "parent-pain": ["askPain", "callParents"],
  // world: life abroad
  "missed-home-country": ["messageHome", "localThing", "outAmongPeople"],
  "missed-familiar-food": ["cookHome", "localDish"],
  "missed-familiar-weather": ["daylight20", "homeSounds"],
  "felt-foreigner": ["localChat", "outAmongPeople"],
  "talked-to-fellow-expats": ["messageExpat", "outAmongPeople"],
  "tried-local-food": ["localProduct", "localThing"],
  "thought-about-going-back": ["goodHardHere", "threeLines"],
  "thought-third-country": ["goodHardHere", "threeLines"],
  "didnt-understand-locals": ["localListen10", "localLang15", "askLocal"],
  // markers with no topic, where a real daily lever exists
  "noisy-neighbors": ["earplugs"],
  "transport-issue": ["leaveEarly15"],
  "climate-drained-me": ["easyTimeOut"],
};

export const getExperiments = (): Experiment[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Experiment[];
  } catch {
    return [];
  }
};
/** Replace the list (a one-time move, src/lib/testWords.ts migrateGoalTests). */
export const replaceExperiments = (list: Experiment[]) => save(list);
const save = (list: Experiment[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* not saved: she can start it again */
  }
  window.dispatchEvent(new Event("memap-islands-changed"));
};

const daysFrom = (from: string, to: string) =>
  Math.round((new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86_400_000);

/** The test running now (started, not yet looked at), if any: the first of them. */
export const currentExperiment = (): Experiment | null => getExperiments().find((x) => !x.reviewed) ?? null;
/** Every test running now: one per island (Nov 7 2026: two changes for the same island at once and
 *  you couldn't tell which helped; different islands run side by side). */
export const runningExperiments = (): Experiment[] => getExperiments().filter((x) => !x.reviewed);
export const testOnIsland = (island: string): Experiment | null => runningExperiments().find((x) => x.island === island) ?? null;
/** 1-based day of the test today (8+ = the week is over). */
export const experimentDay = (x: Experiment, today = isoLocal(new Date())) => daysFrom(x.start, today) + 1;
export const experimentOver = (x: Experiment, today = isoLocal(new Date())) => experimentDay(x, today) > EXPERIMENT_DAYS;
/** Finished tests (looked at), the islands they grew a garden on. */
export const finishedExperiments = () => getExperiments().filter((x) => !!x.reviewed);

const sameChange = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** The other tests whose two weeks overlapped this one's: their effects mix into its result. */
export const overlapping = (x: Experiment): Experiment[] => {
  const end = (e: Experiment) => { const d = new Date(e.start + "T12:00:00"); d.setDate(d.getDate() + EXPERIMENT_DAYS - 1); return isoLocal(d); };
  return getExperiments().filter((e) => e.id !== x.id && e.start <= end(x) && end(e) >= x.start);
};
/** Start a test: adds "Did you…?" to the island, from today (a weekly goal adds nothing:
 *  it watches the question she has). */
export const startExperiment = async (island: string, change: string, question: string, from?: string, opts: { same?: boolean; perWeek?: number; night?: boolean; later?: boolean; wake?: string; doneWhen?: boolean } = {}): Promise<Experiment> => {
  track("experiment_started", { from: from ? "action_point" : "pick", goal: !!opts.same, night: !!opts.night });
  const extra = { ...(opts.night ? { night: true } : {}), ...(opts.wake ? { wake: opts.wake } : {}), ...(opts.doneWhen === false ? { doneWhen: false } : {}) };
  if (opts.same && from) {
    const g: Experiment = { id: `${Date.now()}-goal`, island, trackerId: from, change, start: isoLocal(new Date()), from, same: true, ...(opts.perWeek ? { perWeek: opts.perWeek } : {}), ...extra };
    save([...getExperiments().filter((e) => e.reviewed || !sameChange(e.change, change)), g]);
    window.dispatchEvent(new Event("memap-settings-changed"));
    return g;
  }
  const existing = await getTrackers();
  const tracker: Tracker = {
    id: `${Date.now()}-test`,
    title: change.slice(0, 60),
    category: "Curious",
    questionText: question,
    answerType: "boolean",
    periodDays: 30,
    // No rule on a test question: it never lights a lighthouse.
    threshold: 0,
    problemWhen: "no",
    adviceAboveThreshold: "",
    createdAt: new Date().toISOString(),
    sortIndex: -1,
    island,
    // a night step is asked about the night before, a morning step started in the afternoon about tomorrow's morning:
    // from tomorrow evening
    ...(opts.night || opts.later ? { askFrom: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return isoLocal(d); })() } : {}),
  };
  await saveTrackers([...existing, tracker]);
  const x: Experiment = { id: tracker.id, island, trackerId: tracker.id, change, start: isoLocal(new Date()), ...(from ? { from } : {}), ...extra };
  // several at once, even on one island (Nov 8 2026); the same change twice restarts it
  save([...getExperiments().filter((e) => e.reviewed || !sameChange(e.change, change)), x]);
  window.dispatchEvent(new Event("memap-settings-changed"));
  return x;
};

export interface ExperimentResult {
  /** days she answered the test question */
  answered: number;
  /** days she did the change */
  did: number;
  /** hard days on the island: with the change [k, n] and without [k, n] */
  withChange: [number, number];
  without: [number, number];
  /** hard days on the island in the two weeks before and during the test: the comparison when every
   *  day was "yes" (or "no") and there is nothing to compare inside (Nov 8 2026) */
  before: [number, number];
  during: [number, number];
  /** a goal a week: "yes" days in week 1 and week 2 */
  weeks?: [number, number];
  /** the question, on any island, whose hard days differ most: with/without, else during/before */
  most?: { trackerId: string; hardYes: boolean; by: "with" | "before"; a: [number, number]; b: [number, number] };
}

/** What the counts say, in one line (QA, Nov 8 2026: "8 of 10 · 3 of 4" said nothing): fewer hard
 *  days with it, more, or about the same; when one side is too small (every day "yes"), the two weeks
 *  during against the two before; too few days either way. Never a promise. */
export type Verdict = "few" | "better" | "worse" | "same" | "betterBefore" | "worseBefore" | "sameBefore";
/** Days needed on each side before saying anything (QA re-check, Nov 9 2026: "Maybe this one isn't for
 *  you" came from 3 days without it). */
export const MIN_SIDE = 5;
export const verdictOf = (r: ExperimentResult): Verdict => {
  const cmp = ([a, b]: [number, number], [c, d]: [number, number]) => { const diff = a / b - c / d; return diff <= -0.15 ? "better" : diff >= 0.15 ? "worse" : "same"; };
  if (r.withChange[1] >= MIN_SIDE && r.without[1] >= MIN_SIDE) return cmp(r.withChange, r.without);
  if (r.during[1] >= MIN_SIDE && r.before[1] >= MIN_SIDE) return `${cmp(r.during, r.before)}Before` as Verdict;
  return "few";
};
/** Compare the two sides inside the test (days with it and without), or else during and before. */
export const comparedBy = (r: ExperimentResult): "with" | "before" | null =>
  r.withChange[1] >= MIN_SIDE && r.without[1] >= MIN_SIDE ? "with" : r.during[1] >= MIN_SIDE && r.before[1] >= MIN_SIDE ? "before" : null;

/** How the island's hard days went on days with the change and without (and before it began). */
export const experimentResult = (x: Experiment, trackers: Tracker[], entries: TrackerEntry[]): ExperimentResult => {
  const span = (from: number) => Array.from({ length: EXPERIMENT_DAYS }, (_, i) => {
    const d = new Date(x.start + "T12:00:00");
    d.setDate(d.getDate() + from + i);
    return isoLocal(d);
  });
  const dayList = span(0);
  const days = new Set(dayList);
  const beforeDays = new Set(span(-EXPERIMENT_DAYS));
  // The island's questions (not test questions), hard days by the one rule
  // (isHardAnswer: YES to a hard question, NO to a good one).
  const own = new Map(trackers.filter((t) => !t.archived && !isTestQuestion(t) && t.id !== x.trackerId && islandOf(t) === x.island).map((t) => [t.id, t]));
  const did = new Map<string, boolean>();
  for (const e of entries) if (e.trackerId === x.trackerId && days.has(e.date)) did.set(e.date, doneBy(x, e.value));
  // a hard day by the islands' rule (QA re-check, Nov 9 2026: one hard answer made the day hard here while
  // the island counted half): her topic's question hard, or at least half of that day's answers hard
  const door = getDoorState(), lead = new Set(door ? [door.trackerId, ...(door.extra ?? []).map((y) => y.trackerId)] : []);
  const hardDaysIn = (set: Set<string>) => {
    const per = new Map<string, { a: number; h: number; main: boolean }>();
    for (const e of entries) {
      const t = set.has(e.date) ? own.get(e.trackerId) : undefined;
      if (!t || isNeutralQuestion(t)) continue;
      const d = per.get(e.date) ?? { a: 0, h: 0, main: false };
      d.a++;
      if (isHardAnswer(t, e.value)) { d.h++; if (lead.has(t.id)) d.main = true; }
      per.set(e.date, d);
    }
    return new Set([...per].filter(([, d]) => d.main || (d.a > 0 && d.h * 2 >= d.a)).map(([date]) => date));
  };
  const hard = hardDaysIn(days);
  const answeredHard = new Set(entries.filter((e) => days.has(e.date) && own.has(e.trackerId)).map((e) => e.date));
  const withDays = [...did.entries()].filter(([d, v]) => v && answeredHard.has(d)).map(([d]) => d);
  const withoutDays = [...did.entries()].filter(([d, v]) => !v && answeredHard.has(d)).map(([d]) => d);
  // the two weeks before, the same island's questions
  const beforeAnswered = new Set(entries.filter((e) => beforeDays.has(e.date) && own.has(e.trackerId)).map((e) => e.date));
  const beforeHard = hardDaysIn(beforeDays);
  const r: ExperimentResult = {
    answered: did.size,
    did: [...did.values()].filter(Boolean).length,
    withChange: [withDays.filter((d) => hard.has(d)).length, withDays.length],
    without: [withoutDays.filter((d) => hard.has(d)).length, withoutDays.length],
    before: [beforeHard.size, beforeAnswered.size],
    during: [hard.size, answeredHard.size],
  };
  if (x.perWeek) {
    const yes = (list: string[]) => list.filter((d) => did.get(d) === true).length;
    r.weeks = [yes(dayList.slice(0, 7)), yes(dayList.slice(7))];
  }
  // every question she asks (not the test's, not wishes): where do hard days differ most?
  const by = comparedBy(r);
  if (by) {
    const [setA, setB] = by === "with" ? [new Set(withDays.length ? [...did.entries()].filter(([, v]) => v).map(([d]) => d) : []), new Set([...did.entries()].filter(([, v]) => !v).map(([d]) => d))] : [days, beforeDays];
    // only the test's own island (persona walk, Nov 9 2026: a phone-away test for sleep and anxiety "found" its
    // biggest difference in news she never reads)
    const all = trackers.filter((t) => !t.archived && t.source !== "play" && !isTestQuestion(t) && !isNeutralQuestion(t) && t.id !== x.trackerId && islandOf(t) === x.island
      && !HOME_HARM_IDS.has(matchTemplateIdByTitle(t.title) ?? ""));
    let best: ExperimentResult["most"] | undefined, bestDiff = 0.2;
    for (const t of all) {
      const es = entries.filter((e) => e.trackerId === t.id);
      const side = (set: Set<string>): [number, number] => { const on = es.filter((e) => set.has(e.date)); return [on.filter((e) => isHardAnswer(t, e.value)).length, on.length]; };
      const a = side(setA), b = side(setB);
      if (a[1] < MIN_SIDE || b[1] < MIN_SIDE) continue;
      const diff = Math.abs(a[0] / a[1] - b[0] / b[1]);
      if (diff >= bestDiff) { bestDiff = diff; best = { trackerId: t.id, hardYes: t.problemWhen === "yes", by, a, b }; }
    }
    if (best) r.most = best;
  }
  return r;
};

/** "This week: 2 of 3": the days with "yes" since Monday. */
export const weekDone = (x: Experiment, entries: TrackerEntry[], today = new Date()): number => {
  const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const from = isoLocal(mon), to = isoLocal(today);
  return entries.filter((e) => e.trackerId === x.trackerId && doneBy(x, e.value) && e.date >= from && e.date <= to).length;
};

/** Its own test question goes to the archive (answers stay); a weekly goal's question is hers and stays. */
const archiveTestQuestion = async (x?: Experiment) => {
  if (!x || x.same) return;
  const ts = await getTrackers();
  await saveTrackers(ts.map((t) => (t.id === x.trackerId ? { ...t, archived: true } : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};

/** She looked at the result and answered "Keep going like this?" (Nov 8 2026): yes keeps the question
 *  and the reminder going; no ends both. */
export const finishExperiment = async (id: string, keep: boolean) => {
  const list = getExperiments().map((x) => {
    if (x.id !== id) return x;
    const { remind, ...rest } = x;
    return { ...rest, reviewed: isoLocal(new Date()), kept: keep, ...(keep && remind ? { remind } : {}) };
  });
  save(list);
  if (!keep) await archiveTestQuestion(list.find((e) => e.id === id));
};

/** The ones she kept going after the two weeks. */
export const keptExperiments = (): Experiment[] => getExperiments().filter((x) => !!x.reviewed && !!x.kept);

/** Stop a kept one later: no more question (unless it's hers) and no more reminder. */
export const stopKept = async (id: string) => {
  const list = getExperiments().map((x) => { if (x.id !== id) return x; const { remind: _r, ...rest } = x; return { ...rest, kept: false }; });
  save(list);
  await archiveTestQuestion(list.find((e) => e.id === id));
};
