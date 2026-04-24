/**
 * Safe UUID generator.
 *
 * `crypto.randomUUID()` only exists in a secure context (HTTPS or localhost).
 * When the dev server is accessed from another device on the LAN over plain
 * HTTP (e.g. http://192.168.x.x:8081/ on a phone), `crypto.randomUUID` is
 * `undefined` and calling it throws, which used to silently break saving
 * trackers and answers on mobile.
 *
 * This helper uses `crypto.randomUUID` when available, falls back to
 * `crypto.getRandomValues` (available in non-secure contexts too) to build
 * a v4 UUID, and finally falls back to `Math.random` as a last resort.
 */
export const uuid = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID();
    }
  } catch {
    // fall through
  }

  // RFC4122-ish v4 using getRandomValues (works over plain HTTP)
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
      return (
        hex.slice(0, 4).join("") + "-" +
        hex.slice(4, 6).join("") + "-" +
        hex.slice(6, 8).join("") + "-" +
        hex.slice(8, 10).join("") + "-" +
        hex.slice(10, 16).join("")
      );
    }
  } catch {
    // fall through
  }

  // Last-ditch fallback — not cryptographically strong but never throws.
  const rnd = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${((Math.random() * 4) | 8).toString(16)}${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
};
