/**
 * Gender polish for Russian copy.
 *
 * Russian source strings across the app use bracketed dual forms — e.g.
 *   "Чувствовал(а) ли я стресс сегодня?"
 *   "Ты сегодня сделал(а) что-то для удовольствия?"
 * to keep the locale source files gender-neutral as a safe fallback.
 *
 * At display time we resolve those brackets according to the user's
 * `pol` answer captured during onboarding (stored in
 * `localStorage["memap_interview"].pol`):
 *
 *   "neutral" / unset  →  leave brackets in place ("сделал(а)")
 *   "male"             →  drop the bracketed female suffix ("сделал")
 *   "female"           →  inline the female suffix ("сделала")
 *
 * The whole resolution is a runtime regex pass — locale source files
 * are NEVER mutated, so if anything goes wrong the user still sees a
 * sane (if slightly awkward) bracketed string instead of garbage.
 */
export type Pol = "male" | "female" | "neutral";

const POL_KEY = "memap_interview";

export const POL_CHANGED_EVENT = "memap-pol-changed";

let cachedPol: Pol | null | undefined = undefined;

const readPolFromStorage = (): Pol | null => {
  try {
    const raw = localStorage.getItem(POL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.pol === "male" ||
      parsed?.pol === "female" ||
      parsed?.pol === "neutral"
    ) {
      return parsed.pol;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Read pol from storage, with module-level caching. The cache is
 * invalidated by:
 *   - `memap-pol-changed` (dispatched whenever interview pol updates)
 *   - `memap-language-changed` (cheap belt-and-braces invalidate)
 */
export const getPol = (): Pol | null => {
  if (cachedPol === undefined) cachedPol = readPolFromStorage();
  return cachedPol ?? null;
};

/** Force the next `getPol()` call to re-read from localStorage. */
export const invalidatePolCache = (): void => {
  cachedPol = undefined;
};

if (typeof window !== "undefined") {
  window.addEventListener(POL_CHANGED_EVENT, () => {
    cachedPol = undefined;
  });
  window.addEventListener("memap-language-changed", () => {
    cachedPol = undefined;
  });
}

// Cyrillic word + "(suffix)" — used for the runtime polish pass.
// A Cyrillic letter must sit immediately before the "(" so that
// strings like "наблюдение (необязательно)" (note the space)
// are NOT touched.
const BRACKET_PATTERN = /([А-Яа-яЁё]+?)\(([А-Яа-яЁё]+)\)/g;

/**
 * Polish a Russian string by resolving bracketed gender suffixes.
 *
 *   polishRu("сделал(а)", "male")    → "сделал"
 *   polishRu("сделал(а)", "female")  → "сделала"
 *   polishRu("сделал(а)", "neutral") → "сделал(а)"
 *   polishRu("сделал(а)")            → "сделал(а)"
 *
 * Handles the common past-tense verb pattern (`base + а`). Also
 * accommodates short adjective endings (e.g. `уставший(ая)`) by
 * stripping a trailing -й/-и from the male base before appending the
 * multi-letter female suffix.
 *
 * Strings without bracketed pairs are returned unchanged. English
 * strings are also untouched because the regex only matches Cyrillic.
 */
export const polishRu = (text: string, pol?: Pol | null): string => {
  if (!text) return text;
  if (!pol || pol === "neutral") return text;
  return text.replace(BRACKET_PATTERN, (_match, base: string, suffix: string) => {
    if (pol === "male") return base;
    // pol === "female"

    // Reflexive past tense (-ся): male "ссорился" → female "ссорилась".
    // Source brackets these as "ссорился(ась)" — we strip the "ся" tail
    // and append the bracketed suffix ("ась" → "ссорилась").
    // Also handles "двигался(ась)" → "двигалась", "ложился(ась)" →
    // "ложилась", etc.
    if (/[сС][яЯ]$/.test(base) && /^[аяоеи]сь$/i.test(suffix)) {
      return base.slice(0, -2) + suffix;
    }

    // Irregular -шёл / -шла: male "пришёл" → female "пришла" (drop ёл
    // entirely, append "шла"). Bracketed as "пришёл(а)" in source.
    // Same for "ушёл", "нашёл", "вошёл" etc.
    if (/[шШ][ёЁ][лЛ]$/.test(base)) {
      const replaced = base.replace(/[шШ][ёЁ][лЛ]$/, (m) => {
        // Preserve case of the leading "ш"
        return (m[0] === "Ш" ? "Ш" : "ш") + "ла";
      });
      return replaced;
    }

    // ё→е alternation in past-tense -сти / -чь verbs (regular case),
    // e.g. "Провёл" + "(а)" → "Провела" (not "Провёла").
    // Heuristic: base ends in "ёл" (and not "шёл" — handled above).
    // Replace ё→е before appending the female suffix.
    if (/[ёЁ]л$/.test(base)) {
      const fixed = base.replace(/ё(?=л$)/, "е").replace(/Ё(?=л$)/, "Е");
      return fixed + suffix;
    }

    // Multi-letter suffix starting with a vowel ⇒ likely a full
    // adjective ending replacing a male tail. Strip the masculine
    // -ий / -ой / -ый pair (2 chars) before appending the female
    // ending. E.g. "уставший(ая)" → "уставш" + "ая" = "уставшая".
    if (
      suffix.length >= 2 &&
      /^[аяоеиыэёюАЯОЕИЫЭЁЮ]/.test(suffix) &&
      /[иыоё][йЙ]$/i.test(base)
    ) {
      return base.slice(0, -2) + suffix;
    }
    // Older single-letter rule kept for backwards compat: base ending
    // in just "й" / "и" with a multi-letter vowel suffix.
    if (
      suffix.length >= 2 &&
      /^[аяоеиыэёюАЯОЕИЫЭЁЮ]/.test(suffix) &&
      (base.endsWith("й") || base.endsWith("и") || base.endsWith("Й") || base.endsWith("И"))
    ) {
      return base.slice(0, -1) + suffix;
    }

    // Default — past-tense verb pattern. Concatenation works for
    // every "(а)" / "(ла)" / "(ло)" form we've seen.
    return base + suffix;
  });
};

/**
 * Convenience: resolve pol from storage on each call. Use when you
 * don't already have a Pol in scope.
 */
export const polishRuAuto = (text: string): string => polishRu(text, getPol());
