// "How MeMap works" (Nov 6 2026, the storyline's cheat sheet): the 4 parts in the order the
// month opens them, what the map's signs mean, and that a question can be added any time.
// Big short labels, one short line each (her rule: people don't read).
// The map's signs are drawn as the globe draws them (her note, Nov 15 2026 evening: «картинка island не наша, dot
// between island цвет не наш… надо проверить, что там всё наше»): the island as on the globe, white route dots with
// the chain chip, the weather as the small sign in an island's name, on a piece of the globe's sea.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Link2, Sprout, CloudLightning, CloudSun, Sun } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { mapPic } from "@/lib/islands";
import { haptics } from "@/lib/haptics";
import { IslandAsOnGlobe } from "./IslandAsOnGlobe";

const Dots = () => (
  <span className="grid grid-cols-3 gap-[3px]" aria-hidden="true">
    {["balanced", "balanced", "strong", "balanced", "strong", "balanced"].map((c, i) => (
      <span key={i} className="h-[8px] w-[8px] rounded-full" style={{ background: `hsl(var(--${c}))` }} />
    ))}
  </span>
);

/** the white dots of a route with the chain chip on it, as on the globe (PlanetGlobe: .planet-route, .link-chip) */
const Route = () => (
  <span className="relative flex h-6 w-11 items-center justify-center" aria-hidden="true">
    <svg width="44" height="10" viewBox="0 0 44 10" className="absolute inset-x-0 top-1/2 -translate-y-1/2">
      {[3, 10, 34, 41].map((x) => <circle key={x} cx={x} cy={5} r={2.6} className="planet-route" />)}
    </svg>
    <span className="link-chip relative"><Link2 className="h-3 w-3" strokeWidth={2.8} /></span>
  </span>
);

/** an island's name sign as on the globe: a small white pill (.planet-label) with the weather or the chain in it */
const NameSign = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-7 items-center gap-1 rounded-[14px] bg-white px-2 shadow-[0_6px_14px_-8px_rgba(20,50,90,.5)]" aria-hidden="true">{children}</span>
);

const Line = ({ pic, title, line, step, sea }: { pic: ReactNode; title: string; line: string; step?: string; sea?: boolean }) => (
  <div className="flex items-center gap-3.5 py-2.5">
    <span className={sea
      ? "how-sea flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
      : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-foreground/[0.05]"}>{pic}</span>
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
          <Line pic={<Link2 className="h-6 w-6 text-[hsl(var(--data-a))]" strokeWidth={2.6} />} title={t("world4.links")} step={t("how.week", { n: 2 })} line={t("how.links")} />
          <Line pic={<img src={mapPic("lighthouse")} alt="" width={20} height={26} />} title={t("world4.whenToAct")} step={t("how.week", { n: 3 })} line={t("how.whenToAct")} />
          <Line pic={<Sprout className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />} title={t("world4.whatHelps")} step={t("how.week", { n: 4 })} line={t("how.whatHelps")} />
        </div>

        <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{t("how.mapKicker")}</p>
        <div className="surface mt-2 shrink-0 rounded-[20px] px-4 py-1">
          <Line sea pic={<IslandAsOnGlobe island="me" days={10} className="w-[40px]" />} title={t("how.island")} line={t("how.islandLine")} />
          <Line sea pic={<Route />} title={t("how.route")} line={t("how.routeLine")} />
          <Line sea pic={<NameSign><Link2 className="h-3.5 w-3.5" strokeWidth={2.8} style={{ color: "hsl(var(--data-a))" }} /></NameSign>} title={t("how.inner")} line={t("how.innerLine")} />
          <Line sea pic={<img src={mapPic("lighthouse")} alt="" width={20} height={26} className="drop-shadow-[0_0_6px_hsl(44_96%_60%/0.9)]" />} title={t("how.lit")} line={t("how.litLine")} />
          <Line sea pic={<NameSign><span className="block h-2 w-2 rounded-full bg-[hsl(var(--coin-teal))]" /></NameSign>} title={t("how.main")} line={t("how.mainLine")} />
          {/* the weather: the small sign in an island's name, the same three as on the globe (storm, clouds, sun) */}
          <Line sea pic={<NameSign><CloudLightning className="h-4 w-4" strokeWidth={2.4} style={{ color: "#7D8CC4" }} /></NameSign>} title={t("how.storm")} line={t("how.stormLine")} />
          <Line sea pic={<NameSign><CloudSun className="h-4 w-4" strokeWidth={2.4} style={{ color: "#7D9CC8" }} /></NameSign>} title={t("how.clouds")} line={t("how.cloudsLine")} />
          <Line sea pic={<NameSign><Sun className="h-4 w-4" strokeWidth={2.4} style={{ color: "#E8A93A" }} /></NameSign>} title={t("how.sun")} line={t("how.sunLine")} />
        </div>

        <p className="mt-6 text-[15px] font-semibold leading-snug text-muted-foreground">{t("link.honest")}</p>

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
