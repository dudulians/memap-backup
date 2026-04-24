import { Tracker, TrackerEntry } from "@/types/tracker";

export interface DayStatus {
  date: string;
  status: "balanced" | "significant" | "untracked";
  entry?: TrackerEntry;
}

export interface TrackerStats {
  totalDays: number;
  trackedDays: number;
  significantDays: number;
  balancedDays: number;
  untrackedDays: number;
  significantPercentage: number;
  daysArray: DayStatus[];
}

/**
 * Single source of truth for tracker statistics.
 * Calculates stats for the last N days (tracker.periodDays) including today.
 * 
 * @param tracker - The tracker to calculate stats for
 * @param allEntries - All entries (will be filtered to this tracker and time window)
 * @returns Complete statistics and day-by-day status array
 */
export const getTrackerStats = (
  tracker: Tracker,
  allEntries: TrackerEntry[]
): TrackerStats => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const periodStart = new Date(today);
  periodStart.setDate(today.getDate() - tracker.periodDays + 1);
  
  // Filter entries to this tracker and time window
  const relevantEntries = allEntries.filter((e) => {
    if (e.trackerId !== tracker.id) return false;
    const entryDate = new Date(e.date);
    entryDate.setHours(0, 0, 0, 0);
    return entryDate >= periodStart && entryDate <= today;
  });

  // Build array of all days in the period with their status
  const daysArray: DayStatus[] = [];
  let trackedCount = 0;
  let significantCount = 0;
  let balancedCount = 0;

  for (let i = 0; i < tracker.periodDays; i++) {
    const date = new Date(periodStart);
    date.setDate(periodStart.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const entry = relevantEntries.find((e) => e.date === dateStr);

    let status: "balanced" | "significant" | "untracked" = "untracked";
    
    if (entry) {
      trackedCount++;
      // Determine if this entry is "significant" based on tracker.problemWhen
      const isSignificant =
        tracker.problemWhen === "yes" ? entry.value === true : entry.value === false;
      
      if (isSignificant) {
        status = "significant";
        significantCount++;
      } else {
        status = "balanced";
        balancedCount++;
      }
    }

    daysArray.push({ date: dateStr, status, entry });
  }

  const untrackedCount = tracker.periodDays - trackedCount;
  const significantPercentage = trackedCount > 0 
    ? Math.round((significantCount / trackedCount) * 100) 
    : 0;

  return {
    totalDays: tracker.periodDays,
    trackedDays: trackedCount,
    significantDays: significantCount,
    balancedDays: balancedCount,
    untrackedDays: untrackedCount,
    significantPercentage,
    daysArray,
  };
};
