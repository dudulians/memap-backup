// Pick an avatar (Aurora; drawn at marketing/aurora-light-ux/13-avatar-picker-30.png):
// the chosen one on top, a grid under it, "No avatar" first in the grid.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { AVATARS, avatarUrl, getAvatar, setAvatar } from "@/lib/avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export const AvatarPicker = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | null>(getAvatar());
  // changed elsewhere (another picker, the default): show it as it is now
  useEffect(() => { if (open) setChosen(getAvatar()); }, [open]);
  const pick = (id: string | null) => {
    haptics.tap();
    setChosen(id);
    setAvatar(id);
  };
  const url = avatarUrl(chosen);
  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={t("avatar.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8">
        <h2 className="pb-3 pr-10 pt-1 text-[24px] font-bold tracking-tight">{t("avatar.title")}</h2>
        <div className="flex flex-col items-center rounded-[24px] py-4" style={{ background: "linear-gradient(180deg, #DDF2FA, #BCDDED)" }}>
          <span className="surface flex h-28 w-28 items-center justify-center overflow-hidden rounded-full">
            {url ? <img src={url} alt="" className="h-24 w-24 object-contain" /> : <UserRound className="h-12 w-12 text-muted-foreground" strokeWidth={1.75} />}
          </span>
          <p className="mt-2 text-[17px] font-bold">{chosen ? (chosen.endsWith("malu") ? "Malu" : t(`avatar.name.${chosen.replace(/^\d+_/, "")}`, { defaultValue: "" })) : t("avatar.none")}</p>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2.5">
          <button type="button" onClick={() => pick(null)} aria-pressed={chosen === null} aria-label={t("avatar.none")}
            className={cn("surface relative flex aspect-square items-center justify-center rounded-full", chosen === null && "ring-[3px] ring-[hsl(var(--coin-teal))]")}>
            <UserRound className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
          </button>
          {AVATARS.map((a) => (
            <button key={a.id} type="button" onClick={() => pick(a.id)} aria-pressed={chosen === a.id} aria-label={a.id.endsWith("malu") ? "Malu" : a.id.replace(/^\d+_/, "")}
              className={cn("surface relative flex aspect-square items-center justify-center rounded-full", chosen === a.id && "ring-[3px] ring-[hsl(var(--coin-teal))]")}>
              <img src={a.url} alt="" loading="lazy" className="h-[82%] w-[82%] object-contain" />
              {chosen === a.id && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3.4} /></span>
              )}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
};
