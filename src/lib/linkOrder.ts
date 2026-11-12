// Which comes first on the same day, in the person's own view (her idea, Nov 12 2026: «может, мы будем как-то у
// человека спрашивать, что он думает вероятнее, и исходя из этого дальше строить связь»). The app can't tell from
// one day which of two things came first: drained after work could follow a morning argument (her example). Until the
// person answers, a same-day link claims no order ("Mostly the same days"); an answer puts it in their order.
const KEY = "memap_link_order";
export const LINK_ORDER_EVENT = "memap-link-order";

/** a pair of questions, either way round */
export const orderKey = (a: string, b: string) => [a, b].sort().join("|");

const read = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") ?? {}; } catch { return {}; }
};

/** the id of the question the person thinks comes first, "unsure", or null when not asked yet */
export const getLinkOrder = (a: string, b: string): string | null => read()[orderKey(a, b)] ?? null;

export const setLinkOrder = (a: string, b: string, first: string) => {
  const all = read();
  all[orderKey(a, b)] = first;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full or blocked: the answer lives this session */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LINK_ORDER_EVENT));
};
