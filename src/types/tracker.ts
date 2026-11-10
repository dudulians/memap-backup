export type AnswerType = "boolean" | "scale" | "count" | "note";
export type ProblemWhen = "yes" | "no";

export interface ReflectionCycle {
  id: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD (when "Start new cycle" was pressed)
  periodDays: number;
  threshold: number;
  significantDays: number;
  totalTrackedDays: number;
}

export interface Tracker {
  id: string;
  title: string;
  category: "Emotions" | "Body" | "Connections" | "Voice" | "Health" | "Curious" | "Fun" | "Social";
  subcategory?: string;
  questionText: string;
  answerType: AnswerType;
  periodDays: number;
  threshold: number;
  problemWhen: ProblemWhen;
  adviceAboveThreshold: string;
  createdAt: string;
  archived?: boolean;
  sortIndex?: number;
  /** an action point's plan: done once (then before/after) or a daily 2-week test (Nov 7 2026) */
  planKind?: "once" | "daily";
  cycleStartDate?: string;    // YYYY-MM-DD — start of current observation window
  cycles?: ReflectionCycle[]; // history of completed cycles
  // Marker for "play round" cards — created by random-play mode and shown
  // in a separate section on Cards. User can bulk-delete, or "promote"
  // them to regular cards (which clears this flag).
  source?: "play";
  // Aurora islands (Nov 2 2026): the island she moved this question to,
  // a built-in id ("work", "health"…) or one of her own ("own-…").
  // Unset = its natural island. The classic screens ignore it.
  island?: string;
  // LifeStreams cluster id (e.g. "partner", "health", "external-events").
  // Set when the tracker was created from a library template, OR when
  // the user picked a Theme on the Custom form. Used by correlations
  // as a soft semantic hint: a custom tracker tagged with the same
  // cluster as a library template gets an "expected" verdict even
  // when keyword fallback can't resolve it to a specific template id.
  // Optional — older trackers may not have it.
  cluster?: string;
  // Her own question in words (Nov 7 2026): how MeMap says her yes and no in links
  // ("No walk → migraine"). Library questions have theirs in answerPhrases.ts.
  words?: { yes?: string; no?: string };
  // YYYY-MM-DD: the first evening this question is asked. A night test's question is about last night
  // ("Last night, were you in bed by 23:00?"), so its first evening is the day after the test starts (Nov 10 2026).
  askFrom?: string;
}

/** Asked on this day (a night test's question waits for its first night to be over). */
export const askedOn = (t: Pick<Tracker, "askFrom">, date: string): boolean => !t.askFrom || date >= t.askFrom;

export interface TrackerEntry {
  id: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  value: boolean;
  note?: string;
  // Reason chips from a door entry ("money", "shortSleep"…), stored as
  // stable ids and localized at display time. Optional: evening
  // swipes don't set it, and the correlation engine ignores it.
  tags?: string[];
}
