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
  cycleStartDate?: string;    // YYYY-MM-DD — start of current observation window
  cycles?: ReflectionCycle[]; // history of completed cycles
  // Marker for "play round" cards — created by random-play mode and shown
  // in a separate section on Cards. User can bulk-delete, or "promote"
  // them to regular cards (which clears this flag).
  source?: "play";
  // LifeStreams cluster id (e.g. "partner", "health", "external-events").
  // Set when the tracker was created from a library template, OR when
  // the user picked a Theme on the Custom form. Used by correlations
  // as a soft semantic hint: a custom tracker tagged with the same
  // cluster as a library template gets an "expected" verdict even
  // when keyword fallback can't resolve it to a specific template id.
  // Optional — older trackers may not have it.
  cluster?: string;
}

export interface TrackerEntry {
  id: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  value: boolean;
  note?: string;
}
