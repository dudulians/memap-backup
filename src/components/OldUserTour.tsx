// The old users' onboarding (board 45, Nov 5 2026; her note, Nov 8 2026: "онбординг для старых
// обязательно — это первые, кто получит обновление"). Over the old screens a sheet asks first
// (UpgradeInvite: their own numbers, "Show me" / "Not now"); "Show me" opens the new look, and here
// four screens built from their own answers: their islands on their globe, the four parts of MeMap
// with their numbers, their days as a path, who sails with them. Then Today, with the way back once.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CalendarDays, Check, FlaskConical, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track, useScreen } from "@/lib/analytics";
import { getEntries, getTrackers } from "@/lib/storage";
import { buildIslands, buildRoutes, islandName, mapPic, mapPicFor, type Island, type IslandId, type Route } from "@/lib/islands";
import { islandEvenings } from "@/lib/globeArt";
import { countedDays } from "@/lib/pathSteps";
import { litTrackers } from "@/lib/lighthouses";
import { linkCount, linkHead, trackerLookup } from "@/lib/linkText";
import { AVATARS, DEFAULT_AVATAR, avatarUrl, getAvatar, setAvatar } from "@/lib/avatar";
import { PlanetGlobe } from "./PlanetGlobe";
import type { Tracker } from "@/types/tracker";

const KEY = "memap_old_tour";
/** "Show me" over the old screens: the tour waits for the new look, once. */
export const startOldTour = () => {
  try { if (!localStorage.getItem(`${KEY}_done`)) localStorage.setItem(KEY, "1"); } catch { /* the new look opens without it */ }
};
const pending = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
// it is her tour of the new look: the beginner tips inside the sheets don't show after it (QA, Nov 8 2026)
const finish = () => { try { localStorage.removeItem(KEY); localStorage.setItem(`${KEY}_done`, new Date().toISOString()); localStorage.setItem("memap_tour_completed", "1"); } catch { /* shown again next time */ } };

interface TourData {
  trackers: Tracker[]; islands: Island[]; routes: Route[];
  days: number; evenings: Map<IslandId, number>;
  rules: number; lit: number; questions: number;
}

const STEPS = 4;
const H1 = ({ children }: { children: React.ReactNode }) => <h1 className="text-[29px] font-bold leading-[1.12] tracking-tight">{children}</h1>;

export const OldUserTour = ({ onDone }: { onDone: () => void }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(pending);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<TourData | null>(null);
  const [who, setWho] = useState<string>(() => getAvatar() ?? DEFAULT_AVATAR);

  useEffect(() => {
    if (!open) return;
    let live = true;
    Promise.all([getTrackers(), getEntries()]).then(([trackers, entries]) => {
      if (!live) return;
      const islands = buildIslands(trackers, entries);
      const active = trackers.filter((x) => !x.archived && x.source !== "play");
      setData({
        trackers, islands, routes: buildRoutes(trackers, entries, islands),
        days: countedDays(trackers, entries).length, evenings: islandEvenings(trackers, entries),
        rules: active.filter((x) => x.threshold > 0).length, lit: litTrackers(trackers, entries).size, questions: active.length,
      });
    }).catch(() => { finish(); setOpen(false); });
    return () => { live = false; };
  }, [open]);

  useScreen(`old:${step}`, open);
  useEffect(() => { if (open) track("old_tour_screen", { step }); }, [open, step]);
  const daysOf = useMemo(() => (data ? Object.fromEntries(data.evenings) as Record<string, number> : {}), [data]);
  if (!open || !data) return null;

  const next = () => { haptics.tap(); setStep((s) => Math.min(STEPS - 1, s + 1)); };
  const back = () => { haptics.tap(); setStep((s) => Math.max(0, s - 1)); };
  const done = () => {
    haptics.success();
    setAvatar(who);
    finish();
    track("ui_switched", { to: "new", tour: "done" });
    setOpen(false);
    onDone();
  };
  const route = data.routes[0];
  const btn = "raised-btn mb-5 w-full justify-center";

  return (
    <div className="onb fixed inset-0 z-[100] overflow-hidden bg-background" role="dialog" aria-modal="true" aria-label={t("upgrade.worldTitle")}>
      <div className="relative z-10 h-full w-full overflow-y-auto overscroll-none">
        <div key={step} className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-safe pt-safe animate-fade-in">
          {/* back and where she is */}
          <div className="flex items-center justify-between pt-4">
            {step > 0 ? (
              <button type="button" onClick={back} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.08]">
                <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
              </button>
            ) : <span className="w-11" />}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: STEPS }, (_, i) => <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-[22px] bg-[hsl(var(--coin-teal))]" : "w-2 bg-foreground/25")} />)}
            </div>
            <span className="w-11" />
          </div>

          {step === 0 && (
            <>
              {/* 1. their world: their islands on their globe, their numbers */}
              <div className="relative -mx-5 mt-1 h-[330px]" aria-hidden="true">
                <PlanetGlobe decor sky={false} islands={data.islands} routes={data.routes} avatar={avatarUrl(who)} days={daysOf}
                  labels={data.islands.slice(0, 3).map((i) => i.id)} onOpen={() => undefined} />
              </div>
              <H1>{t("upgrade.hereWorld")}</H1>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {([[data.days, "upgrade.tileDays"], [data.islands.length, "upgrade.tileIslands"], [data.routes.length, "upgrade.tileLinks"]] as const).map(([n, k]) => (
                  <div key={k} className="surface rounded-[18px] px-2 py-3 text-center">
                    <p className="text-[28px] font-bold leading-none tabular-nums">{n}</p>
                    <p className="mt-1.5 text-[14px] font-semibold text-muted-foreground">{t(k, { count: n })}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[17px] font-semibold leading-snug text-muted-foreground">{t("upgrade.islandsLine")}</p>
              {route && (
                <div className="surface mt-3 rounded-[18px] px-4 py-3">
                  <p className="text-[14px] font-semibold text-muted-foreground">{t("upgrade.linkHead")}</p>
                  <p className="mt-0.5 text-[16px] font-bold leading-snug">{linkHead(t, route, trackerLookup(data.trackers))}</p>
                  <p className="mt-0.5 text-[14px] font-medium text-muted-foreground">{linkCount(t, route)}</p>
                </div>
              )}
              <div className="min-h-6 flex-1" />
              <button type="button" onClick={next} className={btn}>{t("common.next")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button>
            </>
          )}

          {step === 1 && (
            <>
              {/* 2. the four parts of MeMap, each with her own number */}
              <div className="mt-6"><H1>{t("upgrade.partsTitle")}</H1></div>
              <div className="mt-6 space-y-2.5">
                {[
                  { icon: <CalendarDays className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />, title: t("world4.myDays"), line: t("upgrade.partDays", { count: data.days }) },
                  { icon: <Link2 className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />, title: t("world4.links"), line: data.routes.length ? t("upgrade.partLinks", { count: data.routes.length }) : t("world4.soon") },
                  { icon: <img src={mapPic("lighthouse")} alt="" width={30} height={34} className="h-8 w-7 object-contain" />, title: t("world4.whenToAct"), line: data.rules ? t("upgrade.partAct", { k: data.lit, count: data.rules }) : t("upgrade.partActNone") },
                  { icon: <FlaskConical className="h-6 w-6 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />, title: t("world4.whatHelps"), line: t("upgrade.partHelps") },
                ].map((r) => (
                  <div key={r.title} className="surface flex items-center gap-3.5 rounded-[20px] px-4 py-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05]">{r.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[18px] font-bold leading-snug">{r.title}</span>
                      <span className="block text-[15px] font-semibold leading-snug text-muted-foreground">{r.line}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="min-h-6 flex-1" />
              <button type="button" onClick={next} className={btn}>{t("common.next")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button>
            </>
          )}

          {step === 2 && (
            <>
              {/* 3. their days are a path now: the past folds into one chip, the lights start */}
              <div className="mt-6"><H1>{t("upgrade.pathTitle")}</H1></div>
              <p className="mt-2 text-[17px] font-semibold leading-snug text-muted-foreground">{t("upgrade.pathLine")}</p>
              <div className="mt-8 flex flex-col items-center" aria-hidden="true">
                <span className="surface inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] font-bold">
                  <Check className="h-4 w-4 text-[hsl(var(--balanced))]" strokeWidth={3} />{t("path.priorDays", { count: data.days })}
                </span>
                {data.islands.slice(0, 3).map((isl, i) => (
                  <div key={isl.id} className="flex flex-col items-center" style={{ marginLeft: i === 1 ? 120 : i === 2 ? -60 : 0, marginTop: i === 0 ? 22 : 10 }}>
                    {i === 0 && <span className="surface mb-2 rounded-[14px] px-4 py-1.5 text-[17px] font-extrabold text-[hsl(var(--coin-teal))]">{t("path.start")}</span>}
                    <span className={cn("flex items-center justify-center rounded-full bg-white shadow-[0_6px_0_rgba(20,40,90,.12)] dark:bg-[hsl(var(--surface))]", i === 0 ? "h-[92px] w-[92px] ring-4 ring-[hsl(var(--coin-teal)/0.25)]" : "h-[68px] w-[68px]")}>
                      <img src={mapPic("icon_" + isl.def.icon)} alt="" width={i === 0 ? 48 : 36} height={i === 0 ? 48 : 36} />
                    </span>
                    <span className="surface mt-1.5 rounded-full px-3 py-1 text-[14px] font-bold">{islandName(t, isl.id)}</span>
                  </div>
                ))}
              </div>
              <div className="min-h-6 flex-1" />
              <button type="button" onClick={next} className={btn}>{t("common.next")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button>
            </>
          )}

          {step === 3 && (
            <>
              {/* 4. who sails with them (the same animals as in You) */}
              <div className="mt-6"><H1>{t("upgrade.whoTitle")}</H1></div>
              <div className="path-boat relative mx-auto mt-4 h-[120px] w-[120px]" aria-hidden="true">
                <span className="bob">
                  <img className="art-day" src={mapPicFor("sailboat", false)} alt="" />
                  <img className="art-night" src={mapPicFor("sailboat", true)} alt="" />
                  {avatarUrl(who) && <img className="who" src={avatarUrl(who)!} alt="" />}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {AVATARS.map((a) => (
                  <button key={a.id} type="button" aria-pressed={who === a.id} aria-label={a.id.replace(/^\d+_/, "")} onClick={() => { haptics.tap(); setWho(a.id); }}
                    className={cn("surface flex aspect-square items-center justify-center rounded-[18px] p-1.5", who === a.id && "pick-on")}>
                    <img src={a.url} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
              {/* the button stays in sight under the long list of animals */}
              <div className="sticky bottom-0 -mx-5 mt-4 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pb-safe pt-6">
                <button type="button" onClick={done} className={btn}>{t("upgrade.setSail")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
