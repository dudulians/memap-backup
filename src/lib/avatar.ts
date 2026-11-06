// Avatars (Aurora, Nov 2026; her set "AppStyle Animal Avatars 30",
// marketing/brand/avatars). Malu comes first: "это как бы наша, только
// немного в стиле другом, но она всё ещё Малу". Since Nov 3 2026 everyone
// starts with an animal (her note: "я бы дала аватара по дефолту"). Since
// Nov 6 2026 that animal is Malu, the face of the reels (her note: "барашка как
// главного аватара — в роликах я буду его использовать"); before, the otter.
// "No avatar" still works; any animal can be picked.
const PICS = Object.entries(import.meta.glob("@/assets/avatars/*.webp", { eager: true, import: "default" }) as Record<string, string>)
  .map(([path, url]) => ({ id: path.split("/").pop()!.replace(".webp", ""), url }))
  .sort((a, b) => a.id.localeCompare(b.id));

/** "01_malu", "02_cat"… in her order, Malu first. */
export const AVATARS = PICS;
export const avatarUrl = (id: string | null): string | null => (id ? PICS.find((a) => a.id === id)?.url ?? null : null);
/** "malu", "cat"… for labels. */
export const avatarName = (id: string) => id.replace(/^\d+_/, "");

const KEY = "memap_avatar";
const NONE_KEY = "memap_avatar_none";
/** She chose "No avatar" (then nothing invites her to pick one). */
export const avatarDeclined = (): boolean => {
  try { return localStorage.getItem(NONE_KEY) === "1"; } catch { return false; }
};
/** Everyone's animal until she picks another (or none). */
export const DEFAULT_AVATAR = "01_malu";
/** The otter was everyone's default until Nov 6 2026 and was written to storage on
 *  first use, so a stored otter is moved to Malu once. A pick made after that
 *  (setAvatar) is kept, the otter too. */
const MOVED_KEY = "memap_avatar_malu";
const hasDefault = () => PICS.some((a) => a.id === DEFAULT_AVATAR);
export const getAvatar = (): string | null => {
  try {
    let v = localStorage.getItem(KEY);
    if (v === "11_otter" && localStorage.getItem(MOVED_KEY) !== "1" && hasDefault()) {
      localStorage.setItem(KEY, DEFAULT_AVATAR); v = DEFAULT_AVATAR;
    }
    localStorage.setItem(MOVED_KEY, "1");
    if (v && PICS.some((a) => a.id === v)) return v;
    if (avatarDeclined() || !hasDefault()) return null;
    localStorage.setItem(KEY, DEFAULT_AVATAR);
    return DEFAULT_AVATAR;
  } catch {
    return hasDefault() ? DEFAULT_AVATAR : null;
  }
};
export const setAvatar = (id: string | null) => {
  try {
    if (id) { localStorage.setItem(KEY, id); localStorage.removeItem(NONE_KEY); localStorage.setItem(MOVED_KEY, "1"); }
    else { localStorage.removeItem(KEY); localStorage.setItem(NONE_KEY, "1"); }
  } catch {
    /* not saved; the picker still shows the choice until reload */
  }
  window.dispatchEvent(new Event("memap-avatar-changed"));
};
