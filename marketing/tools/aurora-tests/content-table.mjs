// Content table (Nov 9 2026, her ask: "как сделать так, чтобы ты находил реальные ошибки").
// Walks see a few people's screens; this dumps EVERY library question with everything the app
// ties to it, in EN and RU, through the app's own functions, so a reviewer can judge each row:
// "does this fit a person who answered this?"
// Run from marketing/tools:  node aurora-tests/content-table.mjs [baseUrl]
// Output: aurora-tests/work/content-table/{questions.json, doors.json, questions.md}
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";

const BASE = process.argv[2] || "http://localhost:8080";
const OUT = "./aurora-tests/work/content-table";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
await page.goto(BASE + "/");
await page.waitForTimeout(1500);

const data = await page.evaluate(async () => {
  const ls = await import("/src/lib/lifeStreams.ts");
  const i18n = (await import("/src/lib/i18n.ts")).default;
  const { setLanguage } = await import("/src/lib/i18n.ts");
  const { cardQuestion } = await import("/src/lib/cardText.ts");
  const { answerPhrase } = await import("/src/lib/answerPhrases.ts");
  const tl = await import("/src/lib/trackerLocalize.ts");
  const { topicOf, ideasForQuestion } = await import("/src/lib/topicIdeas.ts");
  const { islandOf } = await import("/src/lib/islands.ts");
  const { planKindOf } = await import("/src/lib/actionPoints.ts");
  const { testNameOf } = await import("/src/lib/testWords.ts");
  const rq = await import("/src/lib/relatedQuestions.ts");
  const { OBSERVE_TIPS } = await import("/src/lib/observeTipsData.ts");
  const { MOOD_SUPPORT_IDS } = await import("/src/lib/supportLines.ts");
  const { RED_FLAG_IDS } = await import("/src/lib/bodyTemplates.ts");
  const { DOORS } = await import("/src/lib/doors.ts");

  const streams = ls.LIFE_STREAMS;
  const rows = [];
  const seen = new Set();
  const trackerOf = (tpl, clusterId) => ({
    id: `1700000000000-${tpl.id}-0`, title: tpl.title, category: tpl.category, subcategory: tpl.subcategory, cluster: clusterId,
    questionText: tpl.questionText, answerType: tpl.answerType, periodDays: tpl.periodDays, threshold: tpl.threshold,
    problemWhen: tpl.problemWhen, adviceAboveThreshold: tpl.adviceAboveThreshold, createdAt: new Date().toISOString(), sortIndex: 0,
  });
  const has = (k) => i18n.exists(k);
  const side = (lng, tr, tpl) => {
    setLanguage(lng);
    const t = i18n.t.bind(i18n);
    const ideas = ideasForQuestion(tr).map((k) => ({ key: k, change: t(`experiment.idea.${k}.change`), q: has(`experiment.idea.${k}.q`) ? t(`experiment.idea.${k}.q`) : "", today: has(`experiment.idea.${k}.today`) ? t(`experiment.idea.${k}.today`) : "" }));
    const related = rq.getTemplatesByIds(rq.getRelatedTemplateIds([tpl.id])).filter((x) => !x.sensitive && x.id !== tpl.id).map((x) => tl.localizeTrackerTitle(x.title));
    const tip = OBSERVE_TIPS.find((x) => x.templateId === tpl.id);
    return {
      title: tl.localizeTrackerTitle(tr.title),
      card: cardQuestion(tr),
      yes: answerPhrase(t, tr, true),
      no: answerPhrase(t, tr, false),
      plan: tr.adviceAboveThreshold ? testNameOf(tr.adviceAboveThreshold) : "",
      ideas,
      hunchSuspects: related.slice(0, 8),
      tip: tip ? `${tip[lng].title} — ${tip[lng].line}` : "",
    };
  };
  for (const s of streams) for (const tpl of s.templates) {
    if (seen.has(tpl.id)) continue; seen.add(tpl.id);
    const tr = trackerOf(tpl, s.id);
    const en = side("en", tr, tpl), ru = side("ru", tr, tpl);
    rows.push({
      id: tpl.id, stream: s.id, island: islandOf(tr), topic: topicOf(tr), sensitive: !!tpl.sensitive, private: !!tpl.private,
      hardAnswer: tpl.problemWhen, rule: `${tpl.threshold} of ${tpl.periodDays} days`, planKind: tpl.adviceAboveThreshold ? planKindOf(tr) : "",
      redFlagsChip: RED_FLAG_IDS.has(tpl.id), needToTalkChip: MOOD_SUPPORT_IDS.has(tpl.id),
      en, ru,
    });
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  const doorSide = (lng, d) => {
    setLanguage(lng);
    const t = i18n.t.bind(i18n);
    const q = (id) => byId.get(id)?.[lng]?.card ?? `(missing ${id})`;
    const label = ["title", "label", "name"].map((k) => `doors.${d.id}.${k}`).find(has);
    return {
      label: label ? t(label) : "",
      main: q(d.mainTemplateId),
      context: d.contextTemplateIds.map(q),
      reasons: d.reasons.map((r) => (has(`doors.reasons.${r}`) ? t(`doors.reasons.${r}`) : r)),
    };
  };
  const doors = DOORS.map((d) => ({ id: d.id, branch: d.branch, kind: d.kind, main: d.mainTemplateId, context: d.contextTemplateIds, en: doorSide("en", d), ru: doorSide("ru", d) }));
  setLanguage("en");
  return { rows, doors };
});

writeFileSync(`${OUT}/questions.json`, JSON.stringify(data.rows, null, 1));
writeFileSync(`${OUT}/doors.json`, JSON.stringify(data.doors, null, 1));

// A readable sheet, one block per question, grouped by island.
const md = [];
md.push(`# MeMap content table — every library question (${data.rows.length}) and what the app ties to it\n`);
const byIsland = {};
for (const r of data.rows) (byIsland[r.island] ??= []).push(r);
for (const [island, list] of Object.entries(byIsland)) {
  md.push(`\n## ${island} (${list.length})\n`);
  for (const r of list) {
    const flags = [r.sensitive && "SENSITIVE (never offered)", r.private && "private", r.redFlagsChip && "chip: Something worrying?", r.needToTalkChip && "chip: Need to talk?"].filter(Boolean).join(" · ");
    md.push(`### ${r.id} — topic: ${r.topic ?? "none"} · hard answer: ${r.hardAnswer} · rule: ${r.rule}${r.planKind ? ` · plan: ${r.planKind}` : ""}${flags ? ` · ${flags}` : ""}`);
    for (const lng of ["en", "ru"]) {
      const x = r[lng];
      md.push(`- **${lng.toUpperCase()}** title “${x.title}” · card “${x.card}” · yes = “${x.yes}” · no = “${x.no}”`);
      if (x.plan) md.push(`  - When to act plan: ${x.plan}`);
      md.push(`  - Test ideas: ${x.ideas.length ? x.ideas.map((i) => `${i.change} [asks: ${i.q}]`).join(" | ") : "(none — only “write your own”)"}`);
      md.push(`  - Hunch suspects / related: ${x.hunchSuspects.join("; ") || "—"}`);
      if (x.tip) md.push(`  - Worth watching tip: ${x.tip}`);
    }
  }
}
md.push(`\n# Onboarding topics (doors): main question + 3 asked the same day\n`);
for (const d of data.doors) {
  md.push(`- **${d.id}** (${d.branch}, ${d.kind}) EN “${d.en.label}”: main “${d.en.main}”; with: ${d.en.context.map((c) => `“${c}”`).join(", ")}; reasons: ${d.en.reasons.join(", ")}`);
  md.push(`  - RU «${d.ru.label}»: main «${d.ru.main}»; with: ${d.ru.context.map((c) => `«${c}»`).join(", ")}; reasons: ${d.ru.reasons.join(", ")}`);
}
writeFileSync(`${OUT}/questions.md`, md.join("\n"));
console.log(JSON.stringify({ questions: data.rows.length, doors: data.doors.length, noTopic: data.rows.filter((r) => !r.topic && !r.sensitive).map((r) => r.id) }));
await browser.close();
