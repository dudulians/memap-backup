// The actions she did (her notes, Nov 10 2026: "а когда действие сделано, оно будет вот так висеть? или куда-то
// пойдёт" — "надо, чтоб человек где-то видел историю своих действий"). A one-time task marked Done, and a step for a
// partner who shouts or says hurtful things, are kept here with their day; What helps lists them under "Done", next to
// the 2-week tests. Stored on the phone like everything else.
import type { Tracker } from "@/types/tracker";
import { isoLocal } from "@/lib/doors";

export interface DoneAction {
  id: string;
  /** the question the task was for */
  trackerId: string;
  /** the task: her plan's words (once), or the step's text key (home) */
  plan: string;
  /** YYYY-MM-DD */
  date: string;
  kind: "once" | "home";
}

const KEY = "memap_actions_done";
const FILLED = "memap_actions_done_filled";

export const doneActions = (): DoneAction[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? (list as DoneAction[]) : [];
  } catch {
    return [];
  }
};
const save = (list: DoneAction[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* not kept: the card still left the list */ }
  window.dispatchEvent(new Event("memap-islands-changed"));
};

/** "Done" on a task: today, once a day per task. */
export const logDone = (a: Omit<DoneAction, "id" | "date">, date = isoLocal(new Date())) => {
  const list = doneActions().filter((x) => !(x.trackerId === a.trackerId && x.plan === a.plan && x.date === date));
  save([...list, { ...a, date, id: `${a.trackerId}-${date}-${list.length}` }]);
};

/** Tasks marked Done before the history existed (before Nov 10 2026): the last one of each question, from its count
 *  that started again that day. Once, when there are questions to look at. */
export const fillDoneFrom = (trackers: Tracker[]) => {
  if (trackers.length === 0) return;
  try { if (localStorage.getItem(FILLED)) return; localStorage.setItem(FILLED, "1"); } catch { return; }
  const list = doneActions();
  const add: DoneAction[] = [];
  for (const tr of trackers) {
    const last = tr.cycles?.[tr.cycles.length - 1];
    if (tr.planKind !== "once" || !last || !tr.adviceAboveThreshold || list.some((x) => x.trackerId === tr.id)) continue;
    add.push({ id: `${tr.id}-${last.endDate}-old`, trackerId: tr.id, plan: tr.adviceAboveThreshold, date: last.endDate, kind: "once" });
  }
  if (add.length) save([...list, ...add]);
};
