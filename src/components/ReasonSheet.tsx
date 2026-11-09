// "Why?" (her answer, Nov 9 2026: "хочешь заполнить, почему ссорились или почему болела голова? … можно
// скипать"): one sheet for the last days' fights or headaches. Each answer: its day and name, chips to tick
// (as many as fit), a few words if wanted. Save, or Skip (that answer is never asked about again). The same sheet
// changes one answer's reasons from Notes. src/lib/reasons.ts has the rules.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { isoLocal } from "@/lib/doors";
import { getNotes } from "@/lib/notes";
import { chipsFor, markAsked, reasonKey, reasonLabel, reasonName, saveReasons } from "@/lib/reasons";
import type { Tracker, TrackerEntry } from "@/types/tracker";

export type ReasonItem = { trackerId: string; date: string };

/** "Today" / "Yesterday" / "Saturday": the day of an answer, the way the deck and Notes say it. */
export const useReasonDay = () => {
  const { t, i18n } = useTranslation();
  return (iso: string) => {
    const now = new Date();
    const today = isoLocal(now), yesterday = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (iso === today) return t("doors.when.today");
    if (iso === yesterday) return t("doors.when.yesterday");
    const d = new Date(iso + "T12:00:00");
    const ru = i18n.language?.startsWith("ru");
    // within the week its weekday, else the date too
    const s = d.toLocaleDateString(ru ? "ru-RU" : "en-US", now.getTime() - d.getTime() < 6 * 864e5 ? { weekday: "long" } : { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
};

export const ReasonSheet = ({ items, mode, trackers, entries, onClose }: {
  /** the answers to ask about; null: closed */
  items: ReasonItem[] | null;
  /** "ask": the path's step (Save · Skip); "edit": one answer from Notes (Save) */
  mode: "ask" | "edit";
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** how it ended: saved, skipped, or just closed */
  onClose: (how: "saved" | "skipped" | null) => void;
}) => {
  const { t } = useTranslation();
  const dayOf = useReasonDay();
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [words, setWords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const open = !!items && items.length > 0;
  const openKey = (items ?? []).map(reasonKey).join(",");

  // what each answer has already (chips on the answer, its words in a note)
  useEffect(() => {
    if (!items?.length) return;
    const tags: Record<string, string[]> = {};
    for (const it of items) tags[reasonKey(it)] = entries.find((e) => e.trackerId === it.trackerId && e.date === it.date)?.tags ?? [];
    setPicked(tags);
    setWords({});
    getNotes().then((ns) => {
      const w: Record<string, string> = {};
      for (const it of items) { const n = ns.find((x) => x.reasonFor === reasonKey(it)); if (n) w[reasonKey(it)] = n.text; }
      setWords(w);
    }).catch(() => undefined);
  }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return null;
  const byId = new Map(trackers.map((tr) => [tr.id, tr]));
  const today = isoLocal(new Date());
  const keys = items.map(reasonKey);

  const toggle = (key: string, chip: string) => {
    haptics.tap();
    setPicked((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(chip) ? cur.filter((x) => x !== chip) : [...cur, chip] };
    });
  };
  const anything = keys.some((k) => (picked[k]?.length ?? 0) > 0 || !!words[k]?.trim());
  const skip = () => {
    haptics.tap();
    markAsked(keys, "skipped", today, mode === "ask");
    track("reasons_skipped", { answers: keys.length, from: "sheet" });
    onClose("skipped");
  };
  const save = async () => {
    // nothing ticked or written: the same as Skip (it never asks again)
    if (mode === "ask" && !anything) { skip(); return; }
    setBusy(true);
    try {
      await saveReasons(items.map((it) => ({ ...it, tags: picked[reasonKey(it)] ?? [], text: words[reasonKey(it)] ?? "" })));
      markAsked(keys, "saved", today, mode === "ask");
      haptics.success();
      track("reasons_saved", { answers: keys.length, chips: keys.reduce((s, k) => s + (picked[k]?.length ?? 0), 0), words: keys.some((k) => !!words[k]?.trim()), from: mode === "ask" ? "path" : "notes" });
      onClose("saved");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(null); }} ariaTitle={t("why.step")}>
      <div data-reason-sheet className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6">
        <h2 className="pr-10 pt-1 text-[26px] font-bold tracking-tight">{t("why.step")}</h2>
        {items.map((it) => {
          const key = reasonKey(it), tr = byId.get(it.trackerId);
          const on = picked[key] ?? [];
          return (
            <div key={key} data-reason-item={key} className="mt-4 shrink-0">
              <p className="text-[17px] font-bold leading-snug">{dayOf(it.date)} · {reasonName(t, tr)}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${dayOf(it.date)} · ${reasonName(t, tr)}`}>
                {chipsFor(tr, on).map((c) => (
                  <button key={c} type="button" aria-pressed={on.includes(c)} onClick={() => toggle(key, c)} className={cn("chip", on.includes(c) && "is-on")}>
                    {reasonLabel(t, c)}
                  </button>
                ))}
              </div>
              <input type="text" value={words[key] ?? ""} maxLength={200} onChange={(e) => setWords((w) => ({ ...w, [key]: e.target.value }))}
                placeholder={t("why.words")} aria-label={t("why.words")}
                className="mt-2.5 h-12 w-full rounded-2xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 text-[16px] font-medium outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
            </div>
          );
        })}
        <div className="min-h-6 flex-1" />
        <button type="button" onClick={save} disabled={busy} className="raised-btn mt-6 w-full shrink-0 justify-center">{t("common.save")}</button>
        {mode === "ask" && (
          <button type="button" onClick={skip} disabled={busy} className="mt-1 h-11 w-full shrink-0 text-[16px] font-semibold text-muted-foreground">{t("common.skip")}</button>
        )}
      </div>
    </BottomSheet>
  );
};
