// "When is it time to act?" as three big choices, then her plan (src/lib/rules.ts).
// Used wherever a question is made or its action point is changed.
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { RULES, RULE_KEYS, type RuleKey } from "@/lib/rules";

export const RuleChips = ({ hard, value, onChange, plan, onPlan, customLabel, showPlan = true }: {
  /** a YES is a hard day (else: it's missing that counts) */
  hard: boolean;
  value: RuleKey | null;
  onChange: (k: RuleKey, rule: { threshold: number; periodDays: number }) => void;
  plan: string;
  onPlan: (s: string) => void;
  /** an older rule that's none of the three, said in words */
  customLabel?: string;
  /** false when the plan has its own bigger field nearby */
  showPlan?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2.5">
      <p className="text-[16px] font-bold leading-snug">{t(hard ? "rules.whenHard" : "rules.whenGood")}</p>
      <div className="flex flex-wrap gap-2">
        {RULE_KEYS.map((k) => (
          <button key={k} type="button" aria-pressed={value === k}
            onClick={() => { haptics.tap(); onChange(k, RULES[k]); }}
            className={cn("h-11 rounded-full border-[1.5px] px-4 text-[15px] font-semibold transition-colors",
              value === k ? "border-[hsl(var(--coin-teal))] bg-[hsl(var(--coin-teal)/0.14)] font-bold" : "border-foreground/[0.16] bg-foreground/[0.04]")}>
            {t(`rules.${k}`)}
          </button>
        ))}
        {value === null && customLabel && (
          <span className="inline-flex h-11 items-center rounded-full border-[1.5px] border-[hsl(var(--coin-teal))] bg-[hsl(var(--coin-teal)/0.14)] px-4 text-[15px] font-bold">{customLabel}</span>
        )}
      </div>
      {showPlan && value !== "off" && (
        <input value={plan} onChange={(e) => onPlan(e.target.value)} maxLength={90}
          placeholder={t("rules.planPh")} aria-label={t("rules.plan")}
          className="h-12 w-full rounded-xl border border-foreground/[0.12] bg-foreground/[0.04] px-3.5 text-[16px] outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
      )}
    </div>
  );
};
