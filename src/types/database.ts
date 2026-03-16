// Minimal Supabase database type definition
// Generated from supabase/schema.sql

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string | null; created_at: string }
        Insert: { id: string; username?: string | null }
        Update: { username?: string | null }
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          started_at: string
          finished_at: string | null
          duration_seconds: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at: string
          finished_at?: string | null
          duration_seconds?: number | null
          notes?: string | null
        }
        Update: {
          finished_at?: string | null
          duration_seconds?: number | null
          notes?: string | null
        }
      }
      exercises: {
        Row: {
          id: string
          workout_id: string
          name: string
          order_index: number
          superset_group: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          name: string
          order_index?: number
          superset_group?: string | null
        }
        Update: { name?: string; order_index?: number; superset_group?: string | null }
      }
      sets: {
        Row: {
          id: string
          exercise_id: string
          set_number: number
          reps: string | null
          weight: string | null
          set_type: 'normal' | 'warmup' | 'dropset' | 'failure'
          logged_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          exercise_id: string
          set_number: number
          reps?: string | null
          weight?: string | null
          set_type?: 'normal' | 'warmup' | 'dropset' | 'failure'
          logged_at?: string | null
        }
        Update: {
          reps?: string | null
          weight?: string | null
          set_type?: 'normal' | 'warmup' | 'dropset' | 'failure'
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
