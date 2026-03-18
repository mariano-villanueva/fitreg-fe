/**
 * Single source of truth for all workout activity types.
 * Must stay in sync with the `workouts.type` column in the database.
 */
export const WORKOUT_TYPES = [
  'running',
  'cycling',
  'swimming',
  'strength',
  'cardio',
  'yoga',
  'easy',
  'tempo',
  'intervals',
  'long_run',
  'race',
  'fartlek',
  'other',
] as const;

export type WorkoutType = typeof WORKOUT_TYPES[number];
