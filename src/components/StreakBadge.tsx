import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import { getStreakMessage } from "@/lib/streaks";

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export const StreakBadge = ({ streak, className = "" }: StreakBadgeProps) => {
  if (streak === 0) return null;

  const message = getStreakMessage(streak);

  return (
    <Badge
      variant="secondary"
      className={`flex items-center gap-1.5 bg-orange-500/10 text-orange-600 border-orange-500/20 animate-fade-in ${className}`}
    >
      <Flame className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{message}</span>
    </Badge>
  );
};
