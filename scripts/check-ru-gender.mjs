#!/usr/bin/env node
/**
 * Russian gender lint for `src/locales/ru.ts`.
 *
 * Scans the locale file for past-tense Russian verbs that appear in
 * GENDERED form (e.g. "увидела", "сделал") without being wrapped in
 * the project's bracketed pattern ("увидел(а)", "сделал(а)"). Those
 * bracketed forms are resolved at runtime by `src/lib/genderPolish.ts`
 * based on the user's interview-declared gender, so source strings
 * MUST use the brackets — otherwise non-matching users see "Привет,
 * я сделал…" or "…чтобы ты увидела…" which feels exclusionary.
 *
 * Why a static list (and not a smart regex):
 *   Russian morphology is rich enough that any "ends in -л/-ла"
 *   regex catches dozens of false positives (nouns like "стол",
 *   borrowed words, etc.). A curated verb list is dumb but precise.
 *   Add new verbs to GENDERED_VERBS below as the copy grows.
 *
 * Usage:
 *   node scripts/check-ru-gender.mjs            # check, exit 1 on findings
 *   node scripts/check-ru-gender.mjs --quiet    # only print on failure
 *
 * Wire into a pre-commit hook by adding to package.json:
 *   "scripts": { "check:ru": "node scripts/check-ru-gender.mjs" }
 * then run `npm run check:ru` before commits, or invoke from husky.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALE_PATH = resolve(__dirname, "..", "src", "locales", "ru.ts");

// Pairs of [masculine, feminine] gendered verb forms commonly used in
// 2nd-person and 1st-person past-tense copy. If either form appears
// in source without the bracketed neutral wrapper, we flag it.
//
// IMPORTANT: keep entries in lowercase. The check is case-insensitive.
// When you add a new gendered verb to the copy, add BOTH forms here.
const GENDERED_VERBS = [
  // Activity / generic
  ["сделал",      "сделала"],
  ["увидел",      "увидела"],
  ["почувствовал","почувствовала"],
  ["сказал",      "сказала"],
  ["хотел",       "хотела"],
  ["знал",        "знала"],
  ["думал",       "думала"],
  ["вспомнил",    "вспомнила"],
  ["заметил",     "заметила"],
  ["забыл",       "забыла"],
  ["успел",       "успела"],
  ["мог",         "могла"],
  ["должен",      "должна"],
  // Movement / habits
  ["пошёл",       "пошла"],
  ["пришёл",      "пришла"],
  ["ушёл",        "ушла"],
  ["спал",        "спала"],
  ["проспал",     "проспала"],
  ["двигал",      "двигала"],
  ["поговорил",   "поговорила"],
  ["позвонил",    "позвонила"],
  ["написал",     "написала"],
  ["прочитал",    "прочитала"],
  ["выпил",       "выпила"],
  ["поел",        "поела"],
  ["встал",       "встала"],
  // Emotional state
  ["плакал",      "плакала"],
  ["смеялся",     "смеялась"],
  ["устал",       "устала"],
  ["разозлился",  "разозлилась"],
  ["обиделся",    "обиделась"],
  ["обрадовался", "обрадовалась"],
  ["расстроился", "расстроилась"],
  ["переживал",   "переживала"],
  ["волновался",  "волновалась"],
  ["боялся",      "боялась"],
  ["скучал",      "скучала"],
  // "готов / готова" deliberately omitted — usage in Russian most
  // often agrees with a noun's gender (е.g. "Экспорт готов",
  // "Демо готово") rather than the user's, so flagging produces
  // too many false positives. Add a manual check during review if
  // a screen really refers to the user being "ready".
  // Body / health
  ["тренировался","тренировалась"],
  ["заболел",     "заболела"],
  ["выздоровел",  "выздоровела"],
  // Relational
  ["сорвался",    "сорвалась"],
  ["извинился",   "извинилась"],
  ["согласился",  "согласилась"],
  ["отказался",   "отказалась"],
  ["простил",     "простила"],
  ["ругался",     "ругалась"],
  ["ругал",       "ругала"],
  ["обнял",       "обняла"],
  // Pronouns / adjectives with gender markers
  ["сам",         "сама"],
  // "был / была" is everywhere as auxiliary — handle separately
  // because checking it raw produces too many false positives in
  // settings UI ("был обновлён" etc. are formal/passive).
];

// Build a lookup map of all forms with their pair so we know
// what the bracketed wrapper should look like for any single form.
const formToPair = new Map();
for (const [m, f] of GENDERED_VERBS) {
  formToPair.set(m.toLowerCase(), { m, f });
  formToPair.set(f.toLowerCase(), { m, f });
}

const src = readFileSync(LOCALE_PATH, "utf8");
const lines = src.split("\n");

const findings = [];

for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
  const line = lines[lineIdx];
  // Skip comment-only lines
  if (line.trim().startsWith("//")) continue;
  // Lowercased copy to find verbs regardless of capitalisation
  const lower = line.toLowerCase();

  for (const [form, pair] of formToPair.entries()) {
    let searchFrom = 0;
    while (true) {
      const idx = lower.indexOf(form, searchFrom);
      if (idx === -1) break;
      searchFrom = idx + 1;

      // Whole-word match guards. Both ends of the match must NOT be
      // adjacent to another Cyrillic letter — otherwise we hit
      // false positives like "сам" inside "самом" / "Самое", "устал"
      // inside "усталость", "готов" inside "Готовим", "сам" inside
      // "саморефлексии", etc.
      const before = idx > 0 ? lower[idx - 1] : "";
      if (/[а-яё]/.test(before)) continue;
      const afterChar = lower[idx + form.length] || "";
      // Allow ONLY: end of string, whitespace, punctuation, or "(" —
      // the "(" is important so "сделал" inside "сделал(а)" still
      // gets correctly classified as bracketed (and skipped below).
      if (/[а-яё]/.test(afterChar)) continue;

      // Must NOT already be part of a bracketed neutral form. Check
      // the slice [idx-3 .. idx + form.length + 5] for "(а)" or
      // "(а)" suffix right after the masculine form, or "(" right
      // before the feminine fragment, etc.
      const after = line.slice(
        idx + form.length,
        idx + form.length + 5,
      );
      const isBracketed =
        after.startsWith("(а)") ||                    // сделал(а)
        after.startsWith("(а)ся") ||                  // тренировал(а)ся
        after.startsWith("(а)сь") ||                  // улыбал(а)сь
        /^[а-яё](\(а\))?$/.test(after) ||             // catches odd suffixes
        // For feminine form like "сделала", check if it's actually
        // "сделал(а)" rendered already (e.g. the trailing "а" is the
        // bracket close). Walk back to find "(":
        (form === pair.f.toLowerCase() &&
          line.slice(Math.max(0, idx - 3), idx + 2).includes("(а)"));

      if (isBracketed) continue;

      // Must also not be inside a code identifier or English comment.
      // The simplest proxy: the string must look like Russian copy.
      // Skip if the surrounding line is overwhelmingly ASCII (no
      // other Cyrillic except this match).
      const cyrCount = (line.match(/[а-яёА-ЯЁ]/g) || []).length;
      if (cyrCount < form.length + 5) continue;

      findings.push({
        line: lineIdx + 1,
        col: idx + 1,
        form: line.slice(idx, idx + form.length),
        pair,
        snippet: line.trim(),
      });
    }
  }
}

const quiet = process.argv.includes("--quiet");

if (findings.length === 0) {
  if (!quiet) {
    console.log(
      `\x1b[32m✓\x1b[0m ru.ts: all gendered verbs are properly bracketed.`,
    );
  }
  process.exit(0);
}

console.log(
  `\x1b[31m✗ ru.ts: ${findings.length} gendered form(s) found WITHOUT bracket wrapper.\x1b[0m\n`,
);
for (const f of findings) {
  console.log(
    `  \x1b[33m${LOCALE_PATH}:${f.line}:${f.col}\x1b[0m  ` +
      `"${f.form}" → should be "${f.pair.m}(а)" ` +
      (f.pair.m === f.pair.f.replace(/а$/, "")
        ? ""
        : `(neutral pair: ${f.pair.m}/${f.pair.f})`),
  );
  console.log(`    ${f.snippet}`);
}
console.log(
  `\nFix by wrapping the form in the bracketed neutral pattern, e.g.\n` +
    `  "сделал" or "сделала"  →  "сделал(а)"\n` +
    `  "сам" or "сама"        →  "сам(а)"\n` +
    `  "тренировался" or "тренировалась" → "тренировал(а)ся"\n\n` +
    `The genderPolish helper resolves brackets at display time based on\n` +
    `the user's interview gender. Source strings should never be\n` +
    `gendered.\n`,
);
process.exit(1);
