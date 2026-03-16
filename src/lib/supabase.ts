/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ActiveWorkout, DBExercise, DBSet, WorkoutWithExercises } from '@/types/workout'

// Lazily create the client so missing env vars during static prerender don't crash
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    _client = createClient(url, key)
  }
  return _client
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  return getSupabase().auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return getSupabase().auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return getSupabase().auth.signOut()
}

// ── Workout helpers ───────────────────────────────────────────────────────────

export async function saveWorkout(workout: ActiveWorkout, userId: string): Promise<string | null> {
  const loggedSets = workout.exercises.flatMap(e => e.sets.filter(s => s.logged))
  if (loggedSets.length === 0) return null

  const sb = getSupabase()
  const startedAt = new Date(workout.startedAt).toISOString()
  const finishedAt = new Date().toISOString()
  const durationSeconds = Math.floor((Date.now() - workout.startedAt) / 1000)

  const { data: wData, error: wError } = await (sb as any)
    .from('workouts')
    .insert({
      user_id: userId,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_seconds: durationSeconds,
      notes: workout.notes || null,
    })
    .select('id')
    .single()

  if (wError || !wData) {
    console.error('Error saving workout:', wError)
    return null
  }

  const workoutId = wData.id

  for (let i = 0; i < workout.exercises.length; i++) {
    const exercise = workout.exercises[i]
    const loggedSetsForExercise = exercise.sets.filter(s => s.logged)
    if (loggedSetsForExercise.length === 0) continue

    const { data: eData, error: eError } = await (sb as any)
      .from('exercises')
      .insert({
        workout_id: workoutId,
        name: exercise.name,
        order_index: i,
        superset_group: exercise.supersetGroup || null,
      })
      .select('id')
      .single()

    if (eError || !eData) {
      console.error('Error saving exercise:', eError)
      continue
    }

    const exerciseId = eData.id

    const setsToInsert = loggedSetsForExercise.map((s, idx) => ({
      exercise_id: exerciseId,
      set_number: idx + 1,
      reps: s.reps || null,
      weight: s.weight || null,
      set_type: s.type,
      logged_at: s.loggedAt ? new Date(s.loggedAt).toISOString() : null,
    }))

    const { error: sError } = await (sb as any).from('sets').insert(setsToInsert)
    if (sError) console.error('Error saving sets:', sError)
  }

  return workoutId
}

export async function fetchWorkoutHistory(userId: string, limit = 20): Promise<WorkoutWithExercises[]> {
  const { data: workouts, error } = await (getSupabase() as any)
    .from('workouts')
    .select(`*, exercises (*, sets (*))`)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching history:', error)
    return []
  }

  return ((workouts ?? []) as WorkoutWithExercises[]).map(w => ({
    ...w,
    exercises: (w.exercises || [])
      .sort((a: DBExercise, b: DBExercise) => a.order_index - b.order_index)
      .map((e: DBExercise & { sets: DBSet[] }) => ({
        ...e,
        sets: (e.sets || []).sort((a: DBSet, b: DBSet) => a.set_number - b.set_number),
      })),
  }))
}

export async function fetchRecentStats(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sb = getSupabase() as any

  const { data, error } = await sb
    .from('workouts')
    .select('id, duration_seconds, started_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('started_at', weekAgo)

  if (error) return { weeklyCount: 0, weeklySeconds: 0, lastWorkout: null }

  const weeklyCount = (data ?? []).length
  const weeklySeconds = (data ?? []).reduce((sum: number, w: any) => sum + (w.duration_seconds || 0), 0)

  const { data: lastData } = await sb
    .from('workouts')
    .select('started_at, exercises(name)')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  return { weeklyCount, weeklySeconds, lastWorkout: lastData || null }
}
