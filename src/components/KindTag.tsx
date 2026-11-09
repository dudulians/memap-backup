// What a line is (her note, Nov 9 2026: "мне тяжело разбираться что к чему, где задание, где вопрос,
// где вывод"): one small tag in front of it, the same everywhere — Finding (what the answers show),
// Task (what to do), Question (what MeMap asks). Colours in index.css (.kind-*).
import { useTranslation } from "react-i18next";
import { ChartNoAxesColumn, ListTodo, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

export type Kind = "finding" | "task" | "question";
const ICON = { finding: ChartNoAxesColumn, task: ListTodo, question: MessageCircleQuestion } as const;

export const KindTag = ({ kind, extra, className }: { kind: Kind; extra?: string; className?: string }) => {
  const { t } = useTranslation();
  const Icon = ICON[kind];
  return (
    <span className={cn("kind-tag", `kind-${kind}`, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} aria-hidden="true" />
      {t(`kind.${kind}`)}
      {extra && <span className="kind-extra">· {extra}</span>}
    </span>
  );
};
