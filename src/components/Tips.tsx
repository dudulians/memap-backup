// Tips over time (her note, Nov 7 2026: "если он скипает тур, а потом лезет в блоки —
// показывать по одному, что есть что… после тура хочется навигации… нажимаешь на
// барашка — подсказка… про репорт через несколько дней"). Malu says one short line, once.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { avatarUrl, DEFAULT_AVATAR, getAvatar } from "@/lib/avatar";

const KEY = "memap_tips_seen";
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export const tipSeen = (id: string) => read().includes(id);
export const markTip = (id: string) => { try { const s = read(); if (!s.includes(id)) localStorage.setItem(KEY, JSON.stringify([...s, id])); } catch { /* shows again */ } };
/** The tour was walked to its end (else the blocks explain themselves the first time). */
export const TOUR_DONE_KEY = "memap_tour_completed";
export const tourCompleted = () => { try { return localStorage.getItem(TOUR_DONE_KEY) === "1"; } catch { return false; } };

export const maluPic = () => avatarUrl(getAvatar() ?? DEFAULT_AVATAR);

/** One tip, once: Malu, a title, one line, maybe a button. */
export const TipCard = ({ id, title, line, action, onAction, onClose, className }: { id: string; title: ReactNode; line: ReactNode; action?: string; onAction?: () => void; onClose?: () => void; className?: string }) => {
  const { t } = useTranslation();
  const [gone, setGone] = useState(() => tipSeen(id));
  if (gone) return null;
  const close = () => { haptics.tap(); markTip(id); setGone(true); onClose?.(); };
  const pic = maluPic();
  return (
    <div className={cn("surface relative flex shrink-0 gap-3 rounded-[20px] py-3 pl-3 pr-10 animate-fade-in", className)} role="note">
      {pic && <img src={pic} alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />}
      <div className="min-w-0 flex-1">
        {title && <p className="text-[16px] font-bold leading-snug">{title}</p>}
        <p className={cn("text-[15px] font-semibold leading-snug", title ? "mt-0.5 text-muted-foreground" : "")}>{line}</p>
        {action && onAction && (
          <button type="button" onClick={() => { close(); onAction(); }} className="raised-btn is-small mt-2 px-5">{action}</button>
        )}
      </div>
      <button type="button" onClick={close} aria-label={t("common.close")} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground">
        <X className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
};
