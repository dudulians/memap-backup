import { TrackerEntry } from "@/types/tracker";

// Local-date YYYY-MM-DD — matches how entries are written (the
// rest of the app stores `e.date` in local time, not UTC). Using
// toISOString() here meant the streak silently broke whenever
// local date differed from UTC date — e.g. UAE (UTC+4) between
// 00:00 and 04:00 local, every day, the streak was 0 because
// mostRecentDate ("today, local") didn't equal todayStr ("today,
// UTC" = yesterday local).
const localDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface GlobalStreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  totalActiveDays: number;
}

/**
 * Calculate global streak based on any tracker activity
 * A streak day = user answered at least one tracker on that day
 */
export const calculateGlobalStreak = (
  entries: TrackerEntry[]
): GlobalStreakInfo => {
  if (entries.length === 0) {
    return { 
      currentStreak: 0, 
      longestStreak: 0, 
      lastActiveDate: null,
      totalActiveDays: 0
    };
  }

  // Get unique dates (days when user was active)
  const uniqueDates = Array.from(
    new Set(entries.map((e) => e.date))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);

  const lastActiveDate = uniqueDates[0] || null;
  const totalActiveDays = uniqueDates.length;

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

  return { 
    currentStreak, 
    longestStreak, 
    lastActiveDate,
    totalActiveDays
  };
};

export const getGlobalStreakMessage = (streak: number): string => {
  if (streak === 0) return "Start your journey";
  if (streak === 1) return "You started noticing.";
  if (streak === 2) return "Two days of awareness";
  if (streak === 3) return "Nice rhythm forming.";
  if (streak === 7) return "One week of awareness!";
  if (streak === 14) return "Two weeks strong!";
  if (streak === 30) return "One month of mindfulness!";
  if (streak >= 7) return `${streak} days of awareness!`;
  return `${streak} day streak!`;
};

export const getStreakEmoji = (streak: number): string => {
  if (streak === 0) return "🌱";
  if (streak < 3) return "🔥";
  if (streak < 7) return "🔥";
  if (streak < 14) return "⭐";
  if (streak < 30) return "💫";
  return "🏆";
};
