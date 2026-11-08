// Reports from her days. Opened from You and from the support sheet (memap-doctor-report).
// v95 (Nov 7 2026, her notes): who it's for (doctor, therapist, coach, me); short (one page,
// a "справка") or full (everything); the period; every question goes in, island by island,
// and the ones she unticks stay out with their links (remembered for next time); her notes;
// the first page shows live; a PDF goes to the share sheet.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, FileText, Minus } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track, useScreen } from "@/lib/analytics";
import { getEntries, getTrackers } from "@/lib/storage";
import { getNotes, type Note } from "@/lib/notes";
import { getDoorState } from "@/lib/doors";
import { islandName, type IslandId } from "@/lib/islands";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { REPORT_PX, drawReport, reportMainIds, reportQuestions, type Audience, type ReportKind } from "@/lib/doctorReport";
import { jpegsToPdf } from "@/lib/pdfImages";
import type { Tracker, TrackerEntry } from "@/types/tracker";

const AUDIENCES: Audience[] = ["doctor", "therapist", "coach", "me"];
/** the questions she left out, remembered between reports */
const OFF_KEY = "memap_report_off";
const readOff = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(OFF_KEY) ?? "[]") as string[]); } catch { return new Set(); } };
const saveOff = (s: Set<string>) => { try { localStorage.setItem(OFF_KEY, JSON.stringify([...s])); } catch { /* not kept */ } };

export const DoctorReport = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useScreen("report", open);
  const [data, setData] = useState<{ trackers: Tracker[]; entries: TrackerEntry[]; notes: Note[] } | null>(null);
  const [audience, setAudience] = useState<Audience>("doctor");
  const [kind, setKind] = useState<ReportKind>("short");
  const [name, setName] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [openIsles, setOpenIsles] = useState<Set<IslandId>>(new Set());
  const [days, setDays] = useState(28);
  const [withNotes, setWithNotes] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const go = async () => {
      const [trackers, entries, notes] = await Promise.all([getTrackers(), getEntries(), getNotes()]);
      setData({ trackers, entries, notes }); setOff(readOff()); setOpenIsles(new Set()); setOpen(true); setPreview(null);
    };
    window.addEventListener("memap-doctor-report", go);
    return () => window.removeEventListener("memap-doctor-report", go);
  }, []);

  // her questions with answers in the period, island by island, the reader's islands first
  const groups = useMemo(() => (data ? reportQuestions(data.trackers, data.entries, days, audience) : []), [data, days, audience]);
  const allIds = useMemo(() => groups.flatMap((g) => g.qs.map((x) => x.q.id)), [groups]);
  const ids = useMemo(() => allIds.filter((id) => !off.has(id)), [allIds, off]);
  const mainIds = useMemo(() => (data ? reportMainIds() : []), [data]);

  const input = () => {
    const door = getDoorState();
    return { ...data!, audience, kind, ids, mainIds, days, withNotes, name, daysLabel: t(door ? `path.daysLabel.${door.id}` : "path.daysLabel.any") };
  };
  // the first page, redrawn as she changes things
  useEffect(() => {
    if (!data || !open || ids.length === 0) return;
    let alive = true;
    const id = window.setTimeout(async () => {
      const pages = await drawReport(input());
      if (alive) { setPreview(pages[0] ?? null); setPageCount(pages.length); }
    }, 300);
    return () => { alive = false; window.clearTimeout(id); };
  }, [data, open, audience, kind, ids, days, withNotes, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async () => {
    if (!data || busy || ids.length === 0) return;
    setBusy(true); haptics.tap();
    try {
      const pages = await drawReport(input());
      const pdf = jpegsToPdf(pages, REPORT_PX);
      const file = `memap-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      track("doctor_report_made", { audience, kind, questions: ids.length, left_out: allIds.length - ids.length, days, notes: withNotes, named: !!name.trim(), pages: pages.length });
      if (Capacitor.isNativePlatform()) {
        let bin = ""; for (let i = 0; i < pdf.length; i += 0x8000) bin += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
        const written = await Filesystem.writeFile({ path: file, data: btoa(bin), directory: Directory.Cache });
        await Share.share({ title: t("report.title"), url: written.uri, dialogTitle: t("report.title") });
      } else {
        const f = new File([pdf], file, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: t("report.title") }); } catch { /* cancelled */ } }
        else { const url = URL.createObjectURL(f); const a = document.createElement("a"); a.href = url; a.download = file; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 4000); }
      }
    } finally { setBusy(false); }
  };

  const setOffSaved = (next: Set<string>) => { setOff(next); saveOff(next); };
  const toggleQ = (id: string) => { const n = new Set(off); if (n.has(id)) n.delete(id); else n.add(id); setOffSaved(n); };
  const toggleIsle = (qs: string[]) => {
    const n = new Set(off), allOn = qs.every((id) => !off.has(id));
    qs.forEach((id) => (allOn ? n.add(id) : n.delete(id)));
    setOffSaved(n);
  };
  const toggleOpen = (i: IslandId) => setOpenIsles((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const chip = (on: boolean) => cn("surface flex h-12 items-center justify-center gap-1.5 rounded-[16px] px-3 text-[16px] font-bold", on && "pick-on");
  const head = "mt-6 text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground";

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && setOpen(false)} ariaTitle={t("report.title")} className="h-[90vh]">
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <h2 className="pr-10 text-[26px] font-bold leading-tight tracking-tight">{t("report.title")}</h2>
        <p className="mt-1 text-[16px] font-semibold text-muted-foreground">{t(audience === "me" ? "report.lineMe" : "report.line")}</p>

        {/* who it's for: the title, the islands first, the look */}
        <p className={head}>{t("report.who")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {AUDIENCES.map((a) => (
            <button key={a} type="button" aria-pressed={audience === a} onClick={() => { haptics.tap(); setAudience(a); }} className={chip(audience === a)}>{t(`report.audience.${a}`)}</button>
          ))}
        </div>
        {audience !== "me" && (
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder={t("report.namePlaceholder")} aria-label={t("report.namePlaceholder")}
            className="surface mt-2 h-12 w-full rounded-[16px] px-4 text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground" />
        )}

        {/* a one-page summary, or everything */}
        <p className={head}>{t("report.kindLabel")}</p>
        <div className="seg mt-2 w-full" role="group">
          {(["short", "full"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => { haptics.tap(); setKind(k); }} className={cn("chip flex-1", kind === k && "is-on")}>{t(`report.kind.${k}`)}</button>
          ))}
        </div>

        <p className={head}>{t("report.period")}</p>
        <div className="seg mt-2 w-full" role="group">
          {[28, 91].map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => { haptics.tap(); setDays(d); }} className={cn("chip flex-1", days === d && "is-on")}>{t(d === 28 ? "report.weeks4" : "report.months3")}</button>
          ))}
        </div>

        {/* every question goes in; unticked ones stay out, with their links */}
        <p className={head}>{t("report.qs", { k: ids.length, count: allIds.length })}</p>
        <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{t("report.qsLine")}</p>
        {groups.map(({ island, qs }) => {
          const qIds = qs.map((x) => x.q.id), on = qIds.filter((id) => !off.has(id)).length;
          const isOpen = openIsles.has(island), iname = islandName(t, island);
          return (
            <div key={island} className="surface mt-2 rounded-[18px]">
              <div className="flex items-center gap-3 py-1 pl-4 pr-3">
                <button type="button" aria-expanded={isOpen} onClick={() => { haptics.tap(); toggleOpen(island); }} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="truncate text-[17px] font-extrabold">{iname}</span>
                  <span className="shrink-0 text-[15px] font-bold text-muted-foreground">{on}/{qIds.length}</span>
                  <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} strokeWidth={2.4} />
                </button>
                <button type="button" role="checkbox" aria-checked={on === qIds.length ? true : on ? "mixed" : false} aria-label={iname}
                  onClick={() => { haptics.tap(); toggleIsle(qIds); }} className="flex h-11 w-11 items-center justify-center">
                  <span className={cn("tick", on > 0 && "is-on")} aria-hidden="true">{on === qIds.length ? <Check className="h-4 w-4" strokeWidth={3} /> : on ? <Minus className="h-4 w-4" strokeWidth={3} /> : null}</span>
                </button>
              </div>
              {isOpen && (
                <div className="pb-2">
                  {qs.map(({ q }) => {
                    const yes = !off.has(q.id);
                    return (
                      <button key={q.id} type="button" role="checkbox" aria-checked={yes} onClick={() => { haptics.tap(); toggleQ(q.id); }}
                        className="flex min-h-[48px] w-full items-center gap-3 py-1.5 pl-4 pr-[22px] text-left">
                        <span className={cn("min-w-0 flex-1 text-[16px] font-bold leading-snug", !yes && "text-muted-foreground")}>{localizeTrackerTitle(q.title)}</span>
                        <span className={cn("tick", yes && "is-on")} aria-hidden="true">{yes && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button type="button" role="switch" aria-checked={withNotes} onClick={() => { haptics.tap(); setWithNotes((v) => !v); }}
          className="surface mt-5 flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold">{t("report.addNotes")}</span>
            <span className="block text-[14px] font-medium text-muted-foreground">{t("report.addNotesLine")}</span>
          </span>
          <span className={cn("tick", withNotes && "is-on")} aria-hidden="true">{withNotes && <Check className="h-4 w-4" strokeWidth={3} />}</span>
        </button>

        <div className="mt-5 flex justify-center">
          <div className="w-[64%] overflow-hidden rounded-[10px] bg-white shadow-[0_14px_34px_-16px_rgba(30,40,90,.5)]" style={{ aspectRatio: `${REPORT_PX.w} / ${REPORT_PX.h}` }}>
            {preview && ids.length ? <img src={preview} alt={t("report.preview")} className="h-full w-full object-contain" /> : <div className={cn("h-full w-full bg-foreground/[0.05]", ids.length && "animate-pulse")} />}
          </div>
        </div>
        <p className="mt-2 text-center text-[14px] font-medium text-muted-foreground">{t(ids.length ? "report.private" : "report.noQs")}</p>

        <button type="button" disabled={busy || ids.length === 0} onClick={make} className="raised-btn mt-4 w-full justify-center gap-2">
          <FileText className="h-5 w-5" strokeWidth={2.4} /> {t("report.make")}{pageCount > 0 && ids.length > 0 ? ` · ${t("report.pages", { count: pageCount })}` : ""}
        </button>
      </div>
    </BottomSheet>
  );
};
