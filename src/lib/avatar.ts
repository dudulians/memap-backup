// Optional avatars (Aurora, Nov 2026; her set "AppStyle Animal Avatars 30",
// marketing/brand/avatars). Malu comes first: "это как бы наша, только
// немного в стиле другом, но она всё ещё Малу". Nothing is shown by
// default; the app works the same without one.
const PICS = Object.entries(import.meta.glob("@/assets/avatars/*.webp", { eager: true, import: "default" }) as Record<string, string>)
  .map(([path, url]) => ({ id: path.split("/").pop()!.replace(".webp", ""), url }))
  .sort((a, b) => a.id.localeCompare(b.id));

/** "01_malu", "02_cat"… in her order, Malu first. */
export const AVATARS = PICS;
export const avatarUrl = (id: string | null): string | null => (id ? PICS.find((a) => a.id === id)?.url ?? null : null);
/** "malu", "cat"… for labels. */
export const avatarName = (id: string) => id.replace(/^\d+_/, "");

const KEY = "memap_avatar";
export const getAvatar = (): string | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v && PICS.some((a) => a.id === v) ? v : null;
  } catch {
    return null;
  }
};
export const setAvatar = (id: string | null) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* not saved; the picker still shows the choice until reload */
  }
  window.dispatchEvent(new Event("memap-avatar-changed"));
};
