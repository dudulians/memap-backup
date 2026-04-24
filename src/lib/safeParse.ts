/**
 * Safely parse JSON from localStorage, returning a fallback on failure.
 * Prevents app crashes from corrupted or tampered localStorage data.
 */
export const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn('Failed to parse stored data; resetting to default.');
    return fallback;
  }
};
