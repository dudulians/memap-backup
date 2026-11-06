// "How MeMap works" (Nov 6 2026, the storyline's cheat sheet): the 4 parts in the order the
// month opens them, what the map's signs mean, and that a question can be added any time.
// Big short labels, one short line each (her rule: people don't read).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Plus, Spline, Sprout } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { mapPic } from "@/lib/islands";
import { haptics } from "@/lib/haptics";

const Dots = () => (
  <span className="grid grid-cols-3 gap-[3px]" aria-hidden="true">
    {["balanced", "balanced", "strong", "balanced", "strong", "balanced"].map((c, i) => (
      <span key={i} className="h-[8px] w-[8px] rounded-full" style={{ background: `hsl(var(--${c}))` }} />
    ))}
  </span>
);

const Line = ({ pic, title, line, step }: { pic: ReactNode; title: string; line: string; step?: string }) => (
  <div className="flex items-center gap-3.5 py-2.5">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-foreground/[0.05]">{pic}</span>
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline gap-2">
        <span className="text-[17px] font-bold leading-tight">{title}</span>
        {step && <span className="text-[13px] font-bold text-muted-foreground">{step}</span>}
      </span>
      <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-muted-foreground">{line}</span>
    </span>
  </div>
);

export const HowItWorksSheet = ({ open, onClose, onAddQuestion }: { open: boolean; onClose: () => void; onAddQuestion: () => void }) => {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={t("how.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
        <h2 className="pt-1 text-[26px] font-bold leading-tight">{t("how.title")}</h2>

        <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("how.partsKicker")}</p>
        <div className="surface mt-2 shrink-0 rounded-[20px] px-4 py-1">
          <Line pic={<Dots />} title={t("world4.myDays")} step={t("how.week", { n: 1 })} line={t("how.myDays")} />
          <Line pic={<Spline className="h-6 w-6 text-[hsl(var(--data-a))]" strokeWidth={2.6} />} title={t("world4.links")} step={t("how.week", { n: 2 })} line={t("how.links")} />
          <Line pic={<img src={mapPic("lighthouse")} alt="" width={20} height={26} />} title={t("world4.whenToAct")} step={t("how.week", { n: 3 })} line={t("how.whenToAct")} />
          <Line pic={<Sprout className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />} title={t("world4.whatHelps")} step={t("how.week", { n: 4 })} line={t("how.whatHelps")} />
        </div>

        <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("how.mapKicker")}</p>
        <div className="surface mt-2 shrink-0 rounded-[20px] px-4 py-1">
          <Line pic={<img src={mapPic("island_lotus")} alt="" width={38} height={26} className="object-contain" />} title={t("how.island")} line={t("how.islandLine")} />
          <Line pic={
            <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true">
              {[3, 10, 17, 24, 31].map((x) => <circle key={x} cx={x} cy={7} r={2.6} fill="hsl(var(--data-a))" />)}
            </svg>
          } title={t("how.route")} line={t("how.routeLine")} />
          <Line pic={<span className="flex items-center gap-0.5 text-[12px] font-extrabold text-[hsl(var(--data-a))]"><Link2 className="h-3.5 w-3.5" strokeWidth={2.6} />3/4</span>} title={t("how.inner")} line={t("how.innerLine")} />
          <Line pic={<img src={mapPic("lighthouse")} alt="" width={20} height={26} className="drop-shadow-[0_0_6px_hsl(44_96%_60%/0.9)]" />} title={t("how.lit")} line={t("how.litLine")} />
          <Line pic={<span className="h-3 w-3 rounded-full bg-[hsl(var(--coin-teal))]" />} title={t("how.main")} line={t("how.mainLine")} />
        </div>

        <button type="button" onClick={() => { haptics.tap(); onAddQuestion(); }}
          className="surface mt-6 flex h-[60px] shrink-0 items-center gap-3.5 rounded-[20px] px-4 text-left active:scale-[0.98] transition-transform">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Plus className="h-5 w-5" strokeWidth={2.8} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold leading-tight">{t("how.add")}</span>
            <span className="block text-[14px] font-semibold text-muted-foreground">{t("how.addLine")}</span>
          </span>
        </button>
      </div>
    </BottomSheet>
  );
};
