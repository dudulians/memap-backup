// `templateGroups.ts` — backwards-compatibility shim.
//
// Historically MeMap had two parallel template catalogs:
//   - TEMPLATE_GROUPS (English-only, this file)
//   - LIFE_STREAMS (bilingual, `lifeStreams.ts`)
//
// As of the 1.6 repositioning ("memory lies, data doesn't"), the
// canonical catalog is LIFE_STREAMS. This file keeps the old
// `TEMPLATE_GROUPS` export name so existing UI code (AddTrackerModal,
// etc.) doesn't break, but it's now a thin adapter that VIEWS
// LIFE_STREAMS through the legacy shape. Runtime localization is
// handled at render time by `localizeTrackerTitle` /
// `localizeTrackerQuestion` on the consumer side.
import { Tracker, ProblemWhen } from "@/types/tracker";
import { LIFE_STREAMS } from "./lifeStreams";

export interface TemplateGroup {
  id: string;
  title: string;
  description: string;
  /** When set, this group is hidden unless the user opts in to that
   *  context (currently: "expat" — only shown if isExpat === true). */
  gatedBy?: "expat";
  templates: Array<{
    id: string;
    title: string;
    questionText: string;
    category: Tracker["category"];
    subcategory?: string;
    periodDays: number;
    threshold: number;
    problemWhen: ProblemWhen;
    adviceAboveThreshold: string;
    /** Sensitive content (intimacy, libido, ex partners). Hidden by
     *  default; user opts in via Settings → "Show sensitive topics". */
    sensitive?: boolean;
    /** Curated starter template for the cluster — shown first when
     *  the user expands a cluster, with the rest gated behind
     *  "Показать все N →". Three per cluster. */
    featured?: boolean;
  }>;
}

// Adapter: project LIFE_STREAMS down to the legacy TEMPLATE_GROUPS shape.
// English fields are exposed because callers run them through
// `localizeTrackerTitle` etc. — those helpers map EN → RU when needed.
export const TEMPLATE_GROUPS: TemplateGroup[] = LIFE_STREAMS.map((stream) => ({
  id: stream.id,
  title: stream.title,
  description: stream.description,
  gatedBy: stream.gatedBy,
  templates: stream.templates.map((t) => ({
    id: t.id,
    title: t.title,
    questionText: t.questionText,
    category: t.category,
    subcategory: t.subcategory,
    periodDays: t.periodDays,
    threshold: t.threshold,
    problemWhen: t.problemWhen,
    adviceAboveThreshold: t.adviceAboveThreshold,
    sensitive: t.sensitive,
    featured: t.featured,
  })),
}));
