// Reports from her days (Nov 6 2026, her idea; two kinds after her note "две
// версии — для себя с картинками и для врача серьёзнее, но с нашим названием"):
// "For a specialist" (who it's for, her name if she wants it) or "For me" (with
// her islands and treasures); topics, period, notes; the first page shows live;
// a PDF goes to the share sheet. Opened from You (memap-doctor-report).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, FileText } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { getEntries, getTrackers } from "@/lib/storage";
import { getNotes, type Note } from "@/lib/notes";
import { getDoorState } from "@/lib/doors";
import { islandName, islandOf, type IslandId } from "@/lib/islands";
import { AUDIENCE_TOPICS, REPORT_PX, drawReport, type Audience, type ReportStyle } from "@/lib/doctorReport";
import { jpegsToPdf } from "@/lib/pdfImages";
import type { Tracker, TrackerEntry } from "@/types/tracker";

const AUDIENCES: Audience[] = ["doctor", "therapist", "coach"];

export const DoctorReport = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ trackers: Tracker[]; entries: TrackerEntry[]; notes: Note[] } | null>(null);
  const [style, setStyle] = useState<ReportStyle>("pro");
  const [audience, setAudience] = useState<Audience>("doctor");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<IslandId>>(new Set());
  const [days, setDays] = useState(28);
  const [withNotes, setWithNotes] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const go = async () => {
      const [trackers, entries, notes] = await Promise.all([getTrackers(), getEntries(), getNotes()]);
      setData({ trackers, entries, notes }); setOpen(true); setPreview(null);
    };
    window.addEventListener("memap-doctor-report", go);
    return () => window.removeEventListener("memap-doctor-report", go);
  }, []);

  // her topics (islands with questions), in the order she sees them
  const islands = useMemo(() => {
    if (!data) return [] as IslandId[];
    const seen: IslandId[] = [];
    for (const x of data.trackers) if (!x.archived && x.source !== "play") { const i = islandOf(x); if (!seen.includes(i)) seen.push(i); }
    return seen;
  }, [data]);
  // the reader picks the topics first; she can change them
  useEffect(() => {
    const want = AUDIENCE_TOPICS[style === "me" ? "me" : audience];
    const next = new Set(want === "all" ? islands : islands.filter((i) => want.includes(i)));
    setPicked(next.size ? next : new Set(islands));
  }, [style, audience, islands]);
  const input = () => {
    const door = getDoorState();
    return { ...data!, style, audience, islands: [...picked], days, withNotes, name, mainId: door?.trackerId, daysLabel: t(door ? `path.daysLabel.${door.id}` : "path.daysLabel.any") };
  };
  // the first page, redrawn as she changes things
  useEffect(() => {
    if (!data || !open || picked.size === 0) return;
    let alive = true;
    const id = window.setTimeout(async () => {
      const pages = await drawReport(input());
      if (alive) setPreview(pages[0] ?? null);
    }, 300);
    return () => { alive = false; window.clearTimeout(id); };
  }, [data, open, style, audience, picked, days, withNotes, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async () => {
    if (!data || busy) return;
    setBusy(true); haptics.tap();
    try {
      const pages = await drawReport(input());
      const pdf = jpegsToPdf(pages, REPORT_PX);
      const name = `memap-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      track("doctor_report_made", { style, audience: style === "me" ? "me" : audience, topics: picked.size, days, notes: withNotes, named: !!name.trim(), pages: pages.length });
      if (Capacitor.isNativePlatform()) {
        let bin = ""; for (let i = 0; i < pdf.length; i += 0x8000) bin += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
        const written = await Filesystem.writeFile({ path: name, data: btoa(bin), directory: Directory.Cache });
        await Share.share({ title: t("report.title"), url: written.uri, dialogTitle: t("report.title") });
      } else {
        const file = new File([pdf], name, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: t("report.title") }); } catch { /* cancelled */ } }
        else { const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 4000); }
      }
    } finally { setBusy(false); }
  };

  const toggle = (i: IslandId) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const chip = (on: boolean) => cn("surface flex h-12 items-center justify-center gap-1.5 rounded-[16px] px-3 text-[16px] font-bold", on && "pick-on");

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && setOpen(false)} ariaTitle={t("report.title")} className="h-[90vh]">
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <h2 className="pr-10 text-[26px] font-bold leading-tight tracking-tight">{t("report.title")}</h2>
        <p className="mt-1 text-[16px] font-semibold text-muted-foreground">{t(style === "me" ? "report.lineMe" : "report.line")}</p>

        {/* two kinds: a serious one for a specialist, a picture one for herself */}
        <div className="seg mt-4 w-full" role="group">
          {(["pro", "me"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={style === s} onClick={() => { haptics.tap(); setStyle(s); }} className={cn("chip flex-1", style === s && "is-on")}>{t(`report.style.${s}`)}</button>
          ))}
        </div>

        {style === "pro" && (
          <>
            <p className="mt-5 text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("report.who")}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {AUDIENCES.map((a) => (
                <button key={a} type="button" aria-pressed={audience === a} onClick={() => { haptics.tap(); setAudience(a); }} className={chip(audience === a)}>{t(`report.audience.${a}`)}</button>
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder={t("report.namePlaceholder")} aria-label={t("report.namePlaceholder")}
              className="surface mt-3 h-12 w-full rounded-[16px] px-4 text-[16px] font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground" />
          </>
        )}

        <p className="mt-5 text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("report.topics")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {islands.map((i) => (
            <button key={i} type="button" aria-pressed={picked.has(i)} onClick={() => { haptics.tap(); toggle(i); }} className={chip(picked.has(i))}>
              {picked.has(i) && <Check className="h-4 w-4" strokeWidth={3} />}{islandName(t, i)}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[15px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("report.period")}</p>
        <div className="seg mt-2 w-full" role="group">
          {[28, 91].map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => { haptics.tap(); setDays(d); }} className={cn("chip flex-1", days === d && "is-on")}>{t(d === 28 ? "report.weeks4" : "report.months3")}</button>
          ))}
        </div>

        <button type="button" role="switch" aria-checked={withNotes} onClick={() => { haptics.tap(); setWithNotes((v) => !v); }}
          className="surface mt-4 flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold">{t("report.addNotes")}</span>
            <span className="block text-[14px] font-medium text-muted-foreground">{t("report.addNotesLine")}</span>
          </span>
          <span className={cn("tick", withNotes && "is-on")} aria-hidden="true">{withNotes && <Check className="h-4 w-4" strokeWidth={3} />}</span>
        </button>

        <div className="mt-5 flex justify-center">
          <div className="w-[64%] overflow-hidden rounded-[10px] bg-white shadow-[0_14px_34px_-16px_rgba(30,40,90,.5)]" style={{ aspectRatio: `${REPORT_PX.w} / ${REPORT_PX.h}` }}>
            {preview ? <img src={preview} alt={t("report.preview")} className="h-full w-full object-contain" /> : <div className="h-full w-full animate-pulse bg-foreground/[0.05]" />}
          </div>
        </div>
        <p className="mt-2 text-center text-[14px] font-medium text-muted-foreground">{t("report.private")}</p>

        <button type="button" disabled={busy || picked.size === 0} onClick={make} className="raised-btn mt-4 w-full justify-center gap-2">
          <FileText className="h-5 w-5" strokeWidth={2.4} /> {t("report.make")}
        </button>
      </div>
    </BottomSheet>
  );
};
