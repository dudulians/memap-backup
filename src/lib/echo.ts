// Echo lines: one plain sentence after every entry and every evening,
// built only from counts (see doorCounts / strongestContextFact in
// doors.ts). Never a verdict; the "too early" label stays on until the
// correlation engine itself has something to say.
import type { TFunction } from "i18next";
import type { Door, DoorCounts, ContextFact } from "./doors";

export const echoLine = (t: TFunction, door: Door, counts: DoorCounts): string => {
  if (counts.todayValue === true) {
    // "1 in 1 day of counting" reads like a bug on day one.
    if (counts.total === 1) return t("doors.echo.firstToday");
    return t("doors.echo.loggedToday", { total: counts.total, count: counts.daysCounting });
  }
  if (counts.total === 0) return t("doors.echo.nothingYet");
  return `${t(`doors.${door.id}.noneToday`)} ${t("doors.echo.countSoFar", {
    total: counts.total,
    count: counts.daysCounting,
  })}`;
};

/** A question with no "after" words says nothing rather than its key (QA re-check, Nov 9 2026). */
export const factLine = (t: TFunction, fact: ContextFact): string => {
  const after = t(`doors.context.${fact.templateId}.after`, { defaultValue: "" });
  return after ? t("doors.echo.fact", { k: fact.k, n: fact.n, after }) : "";
};
