import { TrackerEntry } from "@/types/tracker";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastAnsweredDate: string | null;
}

/**
 * Calculate streak information for a tracker
 * A streak is maintained by answering on consecutive days
 */
export const calculateStreak = (
  trackerId: string,
  entries: TrackerEntry[]
): StreakInfo => {
  const trackerEntries = entries
    .filter((e) => e.trackerId === trackerId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (trackerEntries.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastAnsweredDate: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Get unique dates
  const uniqueDates = Array.from(
    new Set(trackerEntries.map((e) => e.date))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const lastAnsweredDate = uniqueDates[0] || null;

  // Calculate current streak
  let currentStreak = 0;
  const mostRecentDate = uniqueDates[0];

  // Only count as active streak if answered today or yesterday
  if (mostRecentDate === todayStr || mostRecentDate === yesterdayStr) {
    let checkDate = new Date(mostRecentDate);
    checkDate.setHours(0, 0, 0, 0);

    for (const dateStr of uniqueDates) {
      const entryDate = new Date(dateStr);
      entryDate.setHours(0, 0, 0, 0);

      if (entryDate.getTime() === checkDate.getTime()) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (entryDate < checkDate) {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const currentDate = new Date(uniqueDates[i]);
    const nextDate = new Date(uniqueDates[i + 1]);
    const dayDiff = Math.floor(
      (currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { currentStreak, longestStreak, lastAnsweredDate };
};

export const getStreakMessage = (streak: number): string => {
  if (streak === 0) return "";
  if (streak === 1) return "You started noticing.";
  if (streak === 3) return "Nice rhythm forming.";
  if (streak === 7) return "One week of awareness!";
  if (streak === 14) return "Two weeks strong!";
  if (streak === 30) return "One month of mindfulness!";
  if (streak >= 7) return `${streak} days of awareness!`;
  return `${streak} day streak!`;
};

export const isStreakMilestone = (streak: number): boolean => {
  return streak > 0 && streak % 7 === 0;
};
