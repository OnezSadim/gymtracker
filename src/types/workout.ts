export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure' | 'halfrep'

export interface DropEntry {
  weight: string
  reps: string
}

export interface WorkoutSet {
  id: string
  reps: string        // allows "8", "8.5", "8+" — string for full flexibility
  weight: string      // allows "100", "100.5", "BW", "BW+10"
  type: SetType
  logged: boolean
  loggedAt?: number   // unix timestamp ms
  dropEntries?: DropEntry[]  // for dropset/halfrep: all entries (including first)
}

export interface Exercise {
  id: string
  name: string
  sets: WorkoutSet[]
  supersetGroup?: string  // exercises sharing this value are in a superset
  notes?: string
}

export interface ActiveWorkout {
  id: string
  startedAt: number   // unix timestamp ms
  exercises: Exercise[]
  notes: string
}

// Supabase DB types
export interface DBWorkout {
  id: string
  user_id: string
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  notes: string | null
  created_at: string
}

export interface DBExercise {
  id: string
  workout_id: string
  name: string
  order_index: number
  superset_group: string | null
  created_at: string
}

export interface DBSet {
  id: string
  exercise_id: string
  set_number: number
  reps: string | null
  weight: string | null
  set_type: SetType
  logged_at: string | null
  created_at: string
}

export interface WorkoutWithExercises extends DBWorkout {
  exercises: (DBExercise & { sets: DBSet[] })[]
}
