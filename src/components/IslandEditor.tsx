// Make or change her own island (Aurora, Nov 2 2026; spec:
// marketing/aurora-light-ux/SPEC-own-islands.md §1.2). One screen: the
// island as it will look, its name, idea chips, her icons. She only has to
// type a name: the icon follows the words until she taps one, the look
// follows the icon until she flips it. A name she already has opens that
// island instead of making a twin.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { islandName, mapPic, type Island, type IslandId } from "@/lib/islands";
import {
  createIsland, deleteIsland, getOwnIslands, iconForName, ISLAND_ICONS, lookForIcon, updateIsland,
  type IslandIcon,
} from "@/lib/ownIslands";
import { IslandAsOnGlobe } from "./IslandAsOnGlobe";
import { GrowthLadder } from "./IslandStats";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Pressable } from "@/components/ui/pressable";

const IDEAS: { icon: IslandIcon; key: string }[] = [
  { icon: "career", key: "career" }, { icon: "home", key: "home" }, { icon: "food", key: "food" }, { icon: "books", key: "study" },
  { icon: "music", key: "music" }, { icon: "family", key: "friends" }, { icon: "travel", key: "travel" }, { icon: "hobbies", key: "hobby" },
];

export const IslandEditor = ({
  editId,
  days = 0,
  islands,
  onClose,
  onOpenIsland,
}: {
  /** an own island to change; none = a new one */
  editId?: IslandId | null;
  /** evenings answered on it (its stage); a new one starts at the first stage */
  days?: number;
  islands: Island[];
  onClose: () => void;
  onOpenIsland: (id: IslandId) => void;
}) => {
  const { t } = useTranslation();
  const editing = editId ? getOwnIslands().find((i) => i.id === editId) : undefined;
  const used = new Set(islands.map((i) => i.def.icon));
  const firstFree = ISLAND_ICONS.find((i) => !used.has(i)) ?? "hobbies";
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<IslandIcon>(editing?.icon ?? firstFree);
  const [iconPicked, setIconPicked] = useState(!!editing);
  // the stored look is kept for old data; the globe draws every own island from her pack (globeArt.artOf)
  const look = editing?.look ?? lookForIcon(icon);
  const isle = (editId ?? "own-new") as IslandId;

  const names = useMemo(() => new Map(islands.map((i) => [islandName(t, i.id).toLowerCase(), i.id])), [islands, t]);
  const twin = name.trim() && names.get(name.trim().toLowerCase());
  const sameAsSelf = twin && twin === editId;

  const typeName = (v: string) => {
    setName(v);
    if (!iconPicked) {
      const guess = iconForName(v);
      if (guess) setIcon(guess);
    }
  };
  const pickIcon = (i: IslandIcon) => {
    haptics.tap();
    setIcon(i);
    setIconPicked(true);
  };
  const save = () => {
    if (!name.trim()) return;
    if (twin && !sameAsSelf) { onOpenIsland(twin); return; }
    haptics.success();
    if (editing) updateIsland(editing.id, { name: name.trim().slice(0, 20), icon, look });
    else onOpenIsland(createIsland(name, icon, look).id);
    onClose();
  };

  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={editing ? t("islands.edit") : t("islands.new")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 [&>*]:shrink-0">
        <h2 className="pb-3 pr-10 pt-1 text-[24px] font-bold tracking-tight">{editing ? t("islands.edit") : t("islands.new")}</h2>

        {/* The island as it will stand on the globe, from her pack, and how it grows: the same picture and the same
            stages as everywhere else (Nov 11 2026, her note: the old flat-map island with a house floating over its
            base was "какой-то не наш"; the looks to flip through were never drawn on the globe). */}
        <div data-new-island className="relative flex flex-col items-center rounded-[24px] px-3 pb-3 pt-6" style={{ background: "linear-gradient(180deg, #DDF2FA, #BCDDED)" }}>
          <IslandAsOnGlobe island={isle} days={days} style={{ width: 170 }} />
          <span className="surface mt-2 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3">
            <img src={mapPic("icon_" + icon)} alt="" width={26} height={26} />
            <span className="text-[15px] font-bold text-foreground">{name.trim() || t("islands.myIsland")}</span>
          </span>
        </div>
        <div className="mt-3"><GrowthLadder island={isle} days={days} /></div>

        <input
          value={name}
          onChange={(e) => typeName(e.target.value)}
          maxLength={20}
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder={t("islands.namePh")}
          aria-label={t("islands.name")}
          className="surface mt-4 h-14 w-full rounded-2xl px-4 text-[19px] font-semibold outline-none placeholder:text-muted-foreground/70"
        />

        {/* Ideas, until she types. */}
        {!name && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {IDEAS.filter((i) => !names.has(t(`islands.idea.${i.key}`).toLowerCase())).map((i) => (
              <button key={i.key} type="button" onClick={() => { haptics.tap(); setName(t(`islands.idea.${i.key}`)); setIcon(i.icon); setIconPicked(true); }}
                className="surface inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-[15px] font-semibold">
                <img src={mapPic("icon_" + i.icon)} alt="" width={28} height={28} />
                {t(`islands.idea.${i.key}`)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-5 gap-2.5">
          {ISLAND_ICONS.map((i) => (
            <button key={i} type="button" onClick={() => pickIcon(i)} aria-label={t(`islands.icon.${i}`)} aria-pressed={icon === i}
              className={cn("relative flex aspect-square items-center justify-center rounded-2xl", icon === i ? "ring-[3px] ring-[hsl(var(--coin-teal))]" : "")}>
              <img src={mapPic("icon_" + i)} alt="" className="h-[52px] w-[52px] object-contain" />
              {icon === i && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3.4} /></span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <Pressable tone="teal" haptic="none" disabled={!name.trim()} onClick={save} className="h-[58px] w-full rounded-2xl disabled:opacity-50" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
            {twin && !sameAsSelf ? t("islands.openTwin", { name: name.trim() }) : editing ? t("islands.save") : t("islands.create")}
          </Pressable>
          {editing && (
            <button type="button" onClick={async () => { await deleteIsland(editing.id); window.dispatchEvent(new Event("memap-settings-changed")); onClose(); }}
              className="mx-auto mt-3 block h-11 px-4 text-[15px] font-semibold text-muted-foreground">
              {t("islands.delete")}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
