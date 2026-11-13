// "You" (her notes, Nov 3 2026: "я бы дала аватара по дефолту"; "Week
// summary ›" and "My questions ›" under the map's title looked like
// sub-sections and belonged somewhere else; the camera and the bicycle
// "куда идут?"). One sheet behind her animal: the animal with Change, her
// questions, Settings, then her week, her treasures and her links. It opens
// from the header, the boat on the map and the animal beside her step.
import { useScreen } from "@/lib/analytics";
import { TipCard, tourCompleted } from "./Tips";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, CircleUser, Compass, ListChecks, Settings, Share2, Stethoscope, type LucideProps } from "lucide-react";
import { HowItWorksSheet } from "@/components/HowItWorksSheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarPicker } from "@/components/AvatarPicker";
import { WorldStats } from "@/components/IslandStats";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { buildIslands, buildRoutes } from "@/lib/islands";
import { syncTreasures, worldFacts } from "@/lib/growth";
import { getEntries, getTrackers } from "@/lib/storage";
import { getNotes } from "@/lib/notes";
import { haptics } from "@/lib/haptics";
import { usePlayful } from "@/lib/playful";
import type { Tracker, TrackerEntry } from "@/types/tracker";

const Row = ({ icon: Icon, label, onClick }: { icon: ComponentType<LucideProps>; label: string; onClick: () => void }) => (
  <button type="button" onClick={() => { haptics.tap(); onClick(); }}
    className="flex h-[60px] w-full items-center gap-3.5 px-4 text-left active:bg-foreground/[0.04]">
    <span className="icon-dot h-9 w-9">
      <Icon className="h-5 w-5" strokeWidth={2.2} />
    </span>
    <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{label}</span>
    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/70" strokeWidth={2.4} />
  </button>
);

export const YouSheet = ({ open, onClose, onQuestions, onSettings, onAddQuestion }: {
  open: boolean;
  onClose: () => void;
  /** her questions list (the sheet closes first) */
  onQuestions: () => void;
  onSettings: () => void;
  /** "Add a question — any time" from How MeMap works (both sheets close first) */
  onAddQuestion: () => void;
}) => {
  const { t } = useTranslation();
  useScreen("you", open);
  const [data, setData] = useState<{ trackers: Tracker[]; entries: TrackerEntry[]; notes: number } | null>(null);
  // each visit draws the shelf afresh, with what she has now
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    if (!open) return;
    // not last visit's numbers (the shelf's "New" counts from this look)
    setData(null);
    let live = true;
    Promise.all([getTrackers(), getEntries(), getNotes().catch(() => [])])
      .then(([trackers, entries, notes]) => { if (live) { setData({ trackers, entries, notes: notes.filter((n) => !n.reasonFor).length }); setVisit((v) => v + 1); } })
      .catch(() => undefined);
    return () => { live = false; };
  }, [open]);
  const islands = useMemo(() => (data ? buildIslands(data.trackers, data.entries) : []), [data]);
  const routes = useMemo(() => (data ? buildRoutes(data.trackers, data.entries, islands) : []), [data, islands]);
  const facts = useMemo(() => {
    if (!data) return undefined;
    const f = worldFacts(data.trackers, data.entries, islands, routes, data.notes);
    syncTreasures(f);
    return f;
  }, [data, islands, routes]);
  const questions = data ? data.trackers.filter((tr) => !tr.archived && tr.source !== "play").length : 0;

  const [pic, setPic] = useState<string | null>(() => avatarUrl(getAvatar()));
  useEffect(() => {
    const sync = () => setPic(avatarUrl(getAvatar()));
    window.addEventListener("memap-avatar-changed", sync);
    return () => window.removeEventListener("memap-avatar-changed", sync);
  }, []);
  const [picking, setPicking] = useState(false);
  const [how, setHow] = useState(false);
  const playful = usePlayful();
  // Malu's tips open these straight away
  useEffect(() => {
    const pick = () => setPicking(true), openHow = () => setHow(true);
    window.addEventListener("memap-pick-avatar", pick);
    window.addEventListener("memap-open-how", openHow);
    return () => { window.removeEventListener("memap-pick-avatar", pick); window.removeEventListener("memap-open-how", openHow); };
  }, []);

  return (
    <>
      <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={t("map.you")}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
          <div className="flex shrink-0 flex-col items-center pb-5 pt-1">
            <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-sky-50 ring-4 ring-[hsl(var(--coin-teal)/0.16)] dark:bg-[hsl(var(--surface))]">
              {pic
                ? <img src={pic} alt="" width={76} height={76} className="h-[76px] w-[76px] object-contain" />
                : <CircleUser className="h-12 w-12 text-muted-foreground" strokeWidth={1.6} />}
            </span>
            <button type="button" onClick={() => { haptics.tap(); setPicking(true); }} aria-label={t("you.changeAria")}
              className="mt-3 h-11 rounded-full bg-foreground/[0.06] px-5 text-[16px] font-bold text-foreground">
              {t("you.change")}
            </button>
          </div>
          {!tourCompleted() && <TipCard id="block:you" className="mb-4" title={t("map.you")} line={t(playful ? "tour.you.line" : "tour.you.linePlain")} />}
          {/* shrink-0: in the scrolling column an overflow-hidden box would squash to nothing */}
          <div className="surface shrink-0 overflow-hidden rounded-[20px]">
            <Row icon={ListChecks} label={data ? `${t("today.myQuestions")} · ${questions}` : t("today.myQuestions")} onClick={onQuestions} />
            {/* the report and "Share my world" moved to the World's Share button (Nov 13 2026: the avatar had become a
                drawer for everything) */}
            <div className="ml-[66px] h-px bg-foreground/[0.07]" />
            <Row icon={Compass} label={t("how.title")} onClick={() => setHow(true)} />
            {/* Settings last (her note, Nov 8 2026) */}
            <div className="ml-[66px] h-px bg-foreground/[0.07]" />
            <Row icon={Settings} label={t("common.settings")} onClick={onSettings} />
          </div>
          <div className="mt-5 shrink-0">
            {data && <WorldStats key={visit} islands={islands} routes={routes} trackers={data.trackers} entries={data.entries} facts={facts} />}
          </div>
        </div>
      </BottomSheet>
      <AvatarPicker open={picking} onClose={() => setPicking(false)} />
      <HowItWorksSheet open={how} onClose={() => setHow(false)} onAddQuestion={() => { setHow(false); onAddQuestion(); }} />
    </>
  );
};
