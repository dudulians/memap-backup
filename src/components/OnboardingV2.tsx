// Onboarding v2 screens (Nov 5 2026; boards 49/50, her direction): one line for both
// sides of life, a fork, the promise in her own words with her first island rising from
// a cloud, and who sails with her. The question screens in between are DoorOnboarding's.
//   welcome → fork → (pain list | good list) → promise → when + what came before →
//   that day's questions → first light → who sails with you → Today
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Globe, Link2, MoonStar, Repeat, Sun, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { AVATARS, DEFAULT_AVATAR, avatarUrl, getAvatar, setAvatar } from "@/lib/avatar";
import { art, artOf } from "@/lib/globeArt";
import { islandName, islandOf, mapPicFor, type IslandId } from "@/lib/islands";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import type { Door } from "@/lib/doors";
import type { Tracker } from "@/types/tracker";

const Page = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("min-h-full w-full max-w-md mx-auto flex flex-col px-5 pt-safe pb-safe animate-fade-in", className)}>{children}</div>
);
const Main = ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button type="button" onClick={() => { haptics.tap(); onClick(); }} disabled={disabled} data-onb-interactive className="raised-btn mb-5 w-full justify-center">{children}</button>
);
/** Day and night pictures of one island art or map picture. */
const Pic = ({ src, className, style }: { src: [string, string]; className?: string; style?: React.CSSProperties }) => (
  <span aria-hidden="true" className={cn("block", className)} style={style}>
    <img className="art-day block w-full" src={src[0]} alt="" />
    <img className="art-night block w-full" src={src[1]} alt="" />
  </span>
);
const isle = (name: string): [string, string] => [art(name, false), art(name, true)];
const mapPics = (name: string): [string, string] => [mapPicFor(name, false), mapPicFor(name, true)];

/** 1. One line for both sides; the language in a corner. */
export const WelcomeScreen = ({ onStart }: { onStart: () => void }) => {
  const { t } = useTranslation();
  const [lang, setLang] = useState(getLanguage() === "ru" ? "ru" : "en");
  const [langOpen, setLangOpen] = useState(false);
  const pick = (l: "en" | "ru") => { haptics.tap(); setLang(l); setLanguage(l); setLangOpen(false); };
  const who = avatarUrl(getAvatar() ?? DEFAULT_AVATAR);
  return (
    <Page>
      {/* the language: one globe button, lit softly so it's noticed; the list only on tap
          (her note, Nov 6 2026: "не показывать, что есть ещё русский — только по кнопке") */}
      <div className="relative flex justify-end pt-4">
        <button type="button" onClick={() => { haptics.tap(); setLangOpen((v) => !v); }} aria-haspopup="listbox" aria-expanded={langOpen} aria-label={t("settings.language")}
          className="lang-btn surface flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold">
          <Globe className="h-[18px] w-[18px] text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
          {lang.toUpperCase()}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", langOpen && "rotate-180")} strokeWidth={2.6} />
        </button>
        {langOpen && (
          <div role="listbox" aria-label={t("settings.language")} className="absolute right-0 top-[60px] z-20 w-[200px] bg-white dark:bg-[hsl(var(--surface))] overflow-hidden rounded-[18px] py-1 shadow-[0_14px_34px_-14px_rgba(20,40,90,.5)] animate-fade-in">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button key={l.code} type="button" role="option" aria-selected={lang === l.code} onClick={() => pick(l.code)}
                className="flex h-12 w-full items-center justify-between px-4 text-left text-[16px] font-bold">
                {l.native}
                {lang === l.code && <Check className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={3} />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative mx-auto mt-6 h-[300px] w-full max-w-[360px]" aria-hidden="true">
        <Pic src={isle("11_sakura")} className="onb-float absolute left-[2%] top-[6%] w-[40%]" />
        <Pic src={isle("09_waterfall")} className="onb-float absolute right-[2%] top-0 w-[34%]" style={{ animationDelay: "-1.4s" }} />
        <Pic src={isle("17_lavender_garden")} className="onb-float absolute bottom-[4%] right-[6%] w-[32%]" style={{ animationDelay: "-2.6s" }} />
        <span className="onb-bob absolute bottom-[6%] left-[22%] block w-[40%]">
          <Pic src={mapPics("sailboat")} />
          {who && <img src={who} alt="" className="absolute left-[46%] top-[38%] w-[42%]" />}
        </span>
      </div>
      <div className="flex-1 min-h-4" />
      <h1 className="text-center text-[32px] font-bold leading-[1.12] tracking-tight">{t("doors.v2.welcome")}</h1>
      <p className="mt-2 text-center text-[17px] font-semibold text-muted-foreground">{t("doors.v2.welcomeSub")}</p>
      <div className="h-7" />
      <Main onClick={() => { setLanguage(lang as "en" | "ru"); onStart(); }}>{t("common.start")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></Main>
    </Page>
  );
};

/** 2. The fork: two big cards, nothing to read. */
export const ForkScreen = ({ onPick, onBack }: { onPick: (b: "pain" | "good" | "look") => void; onBack: () => void }) => {
  const { t } = useTranslation();
  const [on, setOn] = useState<"pain" | "good" | null>(null);
  const card = (b: "pain" | "good", Icon: typeof Repeat, color: string, label: string) => (
    <button type="button" onClick={() => { haptics.tap(); setOn(b); }} aria-pressed={on === b} data-onb-interactive
      className={cn("surface flex h-[112px] w-full items-center gap-4 rounded-[22px] px-5 text-left text-[22px] font-bold leading-tight", on === b && "pick-on")}>
      <span className="icon-dot h-14 w-14" style={{ color }}><Icon className="h-7 w-7" strokeWidth={2.2} /></span>
      <span className="min-w-0 flex-1">{label}</span>
      <span aria-hidden="true" className={cn("tick", on === b && "is-on")}>{on === b && <Check className="h-4 w-4" strokeWidth={3} />}</span>
    </button>
  );
  return (
    <Page>
      <div className="flex items-center pt-4">
        <button type="button" onClick={onBack} aria-label={t("common.back")} className="icon-dot h-11 w-11 text-foreground"><ArrowLeft className="h-5 w-5" strokeWidth={2.2} /></button>
      </div>
      <h1 className="mt-5 text-[30px] font-bold leading-[1.12] tracking-tight">{t("doors.v2.forkTitle")}</h1>
      <div className="mt-6 space-y-3.5">
        {card("pain", Repeat, "hsl(16 72% 58%)", t("doors.v2.forkPain"))}
        {card("good", Sun, "hsl(36 86% 52%)", t("doors.v2.forkGood"))}
      </div>
      <div className="flex-1 min-h-6" />
      <button type="button" onClick={() => { haptics.tap(); onPick("look"); }} className="mb-2 h-12 w-full text-[16px] font-semibold text-muted-foreground">{t("doors.v2.forkLook")}</button>
      <Main disabled={!on} onClick={() => on && onPick(on)}>{t("doors.continue")}</Main>
    </Page>
  );
};

/** Which island a door's main question lives on. */
const islandOfDoor = (door: Door): IslandId => {
  const tpl = LIFE_STREAMS.flatMap((s) => s.templates).find((x) => x.id === door.mainTemplateId);
  return tpl ? islandOf({ title: tpl.title, category: tpl.category } as Tracker) : "me";
};

/** 4. The promise in her words (said, not asked: her note, Nov 5 2026), and her first island rises from a cloud. */
export const PromiseScreen = ({ door, onNext, onBack }: { door: Door; onNext: () => void; onBack: () => void }) => {
  const { t } = useTranslation();
  const island = useMemo(() => islandOfDoor(door), [door]);
  return (
    <Page>
      <div className="flex items-center pt-4">
        <button type="button" onClick={onBack} aria-label={t("common.back")} className="icon-dot h-11 w-11 text-foreground"><ArrowLeft className="h-5 w-5" strokeWidth={2.2} /></button>
      </div>
      <div className="relative mx-auto mt-10 h-[230px] w-[260px]" aria-hidden="true">
        <Pic src={isle("cloud_island_03")} className="onb-cloud-out absolute bottom-0 left-0 w-full" />
        <Pic src={isle(artOf(island, 0))} className="onb-rise absolute bottom-[12%] left-[8%] w-[84%]" />
      </div>
      <div className="mt-3 flex justify-center">
        <span className="planet-label is-static"><span>{islandName(t, island)}</span></span>
      </div>
      <div className="flex-1 min-h-6" />
      <h1 className="text-center text-[30px] font-bold leading-[1.15] tracking-tight">{t(`doors.${door.id}.promise`)}</h1>
      <p className="mt-2 text-center text-[16px] font-semibold text-muted-foreground">{t("doors.v2.promiseSub")}</p>
      <div className="h-7" />
      <Main onClick={onNext}>{t("doors.v2.letsStart")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></Main>
    </Page>
  );
};

/** The first light, and what comes next (honest: the first links need about 10 evenings). */
export const FirstLightPath = () => {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto h-[250px] w-[260px]" aria-hidden="true">
      <span className="report-badge is-small absolute left-[88px] top-0"><Check className="h-9 w-9" strokeWidth={3} /></span>
      <span className="planet-label" style={{ left: 128, top: 94 }}><span>{t("doors.v2.today")}</span></span>
      <span className="onb-disc absolute left-[150px] top-[128px]"><MoonStar className="h-6 w-6" strokeWidth={2.2} /></span>
      <span className="planet-label opacity-80" style={{ left: 178, top: 192 }}><span>{t("doors.v2.tomorrow")}</span></span>
      <span className="onb-disc is-link absolute left-[34px] top-[150px]"><Link2 className="h-6 w-6" strokeWidth={2.4} /></span>
      <span className="planet-label opacity-80" style={{ left: 64, top: 214 }}><span>{t("doors.v2.day10")}</span></span>
    </div>
  );
};

/** Who sails with her: the animal on her boat (Malu first, or no one). */
export const CompanionScreen = ({ onDone }: { onDone: () => void }) => {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | null>(getAvatar() ?? DEFAULT_AVATAR);
  const [all, setAll] = useState(false);
  const list = all ? AVATARS : AVATARS.slice(0, 9);
  const pick = (id: string | null) => { haptics.tap(); setChosen(id); setAvatar(id); };
  const url = avatarUrl(chosen);
  return (
    <Page>
      <h1 className="mt-8 text-center text-[30px] font-bold leading-[1.12] tracking-tight">{t("doors.v2.sailTitle")}</h1>
      <span className="onb-bob relative mx-auto mt-4 block w-[150px]" aria-hidden="true">
        <Pic src={mapPics("sailboat")} />
        {url && <img src={url} alt="" className="absolute left-[46%] top-[38%] w-[42%]" />}
      </span>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {list.map((a) => (
          <button key={a.id} type="button" onClick={() => pick(a.id)} aria-pressed={chosen === a.id} aria-label={a.id.replace(/^\d+_/, "")} data-onb-interactive
            className={cn("surface flex h-[92px] items-center justify-center rounded-[20px]", chosen === a.id && "pick-on")}>
            <img src={a.url} alt="" loading="lazy" className="h-[70px] w-[70px] object-contain" />
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-5 text-[16px] font-semibold text-muted-foreground">
        {!all && <button type="button" onClick={() => setAll(true)} className="h-11">{t("doors.v2.moreAnimals")}</button>}
        <button type="button" onClick={() => pick(null)} aria-pressed={chosen === null} className={cn("inline-flex h-11 items-center gap-1.5", chosen === null && "text-foreground")}>
          <UserRound className="h-4 w-4" strokeWidth={2.2} /> {t("doors.v2.noOne")}
        </button>
      </div>
      <div className="flex-1 min-h-6" />
      <Main onClick={onDone}>{t("doors.v2.sailGo")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} /></Main>
    </Page>
  );
};
