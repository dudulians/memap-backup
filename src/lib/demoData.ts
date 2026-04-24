import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries } from "./storage";
import { uuid } from "@/lib/uuid";

/**
 * Generate random entries for all trackers for the last N days
 * @param days Number of days to generate data for (including today)
 */
export const generateRandomEntriesForLastNDays = async (days: number): Promise<void> => {
  const trackers = await getTrackers();
  const existingEntries = await getEntries();
  
  if (trackers.length === 0) {
    throw new Error("No trackers found. Please add trackers first.");
  }

  const newEntries: TrackerEntry[] = [...existingEntries];
  const today = new Date();
  
  // Create a set of existing entry keys for quick lookup
  const existingKeys = new Set(
    existingEntries.map(e => `${e.trackerId}-${e.date}`)
  );

  trackers.forEach((tracker) => {
    // Different probability profiles for variety
    const problemProbability = getProbabilityForTracker(tracker);
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split("T")[0];
      
      const entryKey = `${tracker.id}-${dateString}`;
      
      // Only create if entry doesn't exist
      if (!existingKeys.has(entryKey)) {
        const randomValue = Math.random() < problemProbability;
        
        newEntries.push({
          id: uuid(),
          trackerId: tracker.id,
          date: dateString,
          value: randomValue,
        });
      }
    }
  });

  await saveEntries(newEntries);
};

/**
 * Get probability based on tracker's threshold to create realistic data
 */
const getProbabilityForTracker = (tracker: Tracker): number => {
  // Calculate a probability that will result in some trackers being 
  // near threshold, some above, some below
  const targetProblemDays = tracker.threshold * (0.6 + Math.random() * 0.8);
  const probability = targetProblemDays / tracker.periodDays;
  
  // Clamp between 0.1 and 0.7 for realistic variation
  return Math.max(0.1, Math.min(0.7, probability));
};

/**
 * Clear all tracker entries from storage
 */
export const clearAllEntries = async (): Promise<void> => {
  await saveEntries([]);
};
