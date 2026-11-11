// Niche questions (her note, Nov 10 2026: "Давай нишевые вопросы тоже убирать и заменять чем-то простым"; about
// "Screenshotted a chat": "я даже не понимаю почему вообще это нужно отслеживать").
//
// Archived, never deleted, the same way as "minimum medicine" (medicalArchive.ts): these questions are no longer offered
// to new people (library, search, ideas, islands, hunches, starters). Anyone who already has one keeps it, with its
// answers, links and tests. Take an id out of the set and the question is offered again. The list and the reasons:
// marketing/research/niche-questions-review-2026-11-10.md.

export const NICHE_IDS = new Set([
  // no clear reason to track
  "screenshotted-chat", "deleted-own-post", "rewatched-stories", "didnt-like-friend-post", "deleted-message",
  "looped-one-song", "wore-same-shirt", "ate-by-fridge", "liked-my-selfie", "talked-to-pet", "danced-or-sang-alone",
  "cried-from-something-small",
  // repeat a simple question that is already there
  "skipped-cleaning", "bought-on-sale", "paid-to-skip-effort", "less-caffeine-than-usual", "watched-course-lecture",
  "wanted-learn-new",
  // too wide (Nov 11 2026, her note: «слишком широкий»): the app never asks for a morning promise, and its narrow
  // versions are already there (workout, phone-free morning, bed before midnight, the main task, sweets, water…)
  "kept-morning-promise",
  // very narrow body and moving-abroad questions
  "pill-free-day", "pelvic-floor-exercises", "thought-third-country", "missed-familiar-weather",
  "local-institution-contact", "tried-local-food",
]);

/** Lay the archive over the library (called once, from lifeStreams.ts, after all templates are in). */
export const applyNicheArchive = (streams: { templates: { id: string; quiet?: boolean }[] }[]) => {
  for (const s of streams) for (const t of s.templates) if (NICHE_IDS.has(t.id)) t.quiet = true;
};
