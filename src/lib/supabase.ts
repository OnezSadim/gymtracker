/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ─── SUPABASE SCHEMA (project: ruqwmwxsoizviijmtpey) ────────────────────────
 *
 * profiles          id uuid PK (→ auth.users), username text, created_at
 *   RLS: select=public, insert=own, update=own
 *   trigger: handle_new_user → auto-insert on auth.users insert (username = email prefix)
 *
 * workouts          id uuid PK, user_id (→profiles), started_at, finished_at,
 *                   duration_seconds int, notes text, created_at
 *   RLS: select/insert/update/delete = own (user_id = auth.uid())
 *
 * exercises         id uuid PK, workout_id (→workouts), name text, order_index int,
 *                   superset_group text, created_at
 *   RLS: select/insert/delete = own (via workouts.user_id)
 *
 * sets              id uuid PK, exercise_id (→exercises), set_number int,
 *                   reps text, weight text, set_type (normal|warmup|dropset|failure),
 *                   logged_at timestamptz, created_at
 *   RLS: select/insert = own (via exercises → workouts.user_id)
 *
 * battle_groups     id uuid PK, name text, invite_code text UNIQUE (6-char upper),
 *                   created_by (→profiles), created_at
 *   RLS: select=public, insert=own (created_by), delete=own
 *
 * group_members     PK(group_id, user_id), group_id (→battle_groups),
 *                   user_id (→profiles), joined_at
 *   RLS: select=public, insert=own (user_id), delete=own
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ActiveWorkout, DBExercise, DBSet, WorkoutWithExercises } from '@/types/workout'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    _client = createClient(url, key)
  }
  return _client
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  return getSupabase().auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return getSupabase().auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return getSupabase().auth.signOut()
}

// Ensures a profile row exists for the user (new signups sometimes miss the trigger)
export async function ensureProfile(userId: string, email: string) {
  const username = email.split('@')[0]
  return (getSupabase() as any)
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: true })
}

export async function updateUsername(userId: string, username: string) {
  // Upsert so it works even if the profile row was never created
  return (getSupabase() as any)
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id' })
}

// ── Workouts ──────────────────────────────────────────────────────────────────

export async function saveWorkout(workout: ActiveWorkout, userId: string, userEmail?: string): Promise<string | null> {
  const loggedSets = workout.exercises.flatMap(e => e.sets.filter(s => s.logged))
  if (loggedSets.length === 0) return null

  const sb = getSupabase() as any

  // Ensure profile exists (guard against trigger not firing on signup)
  if (userEmail) await ensureProfile(userId, userEmail)

  const { data: wData, error: wError } = await sb
    .from('workouts')
    .insert({
      user_id: userId,
      started_at: new Date(workout.startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_seconds: Math.floor((Date.now() - workout.startedAt) / 1000),
      notes: workout.notes || null,
    })
    .select('id')
    .single()

  if (wError || !wData) { console.error('saveWorkout:', wError); return null }

  for (let i = 0; i < workout.exercises.length; i++) {
    const exercise = workout.exercises[i]
    const logged = exercise.sets.filter(s => s.logged)
    if (logged.length === 0) continue

    const { data: eData, error: eError } = await sb
      .from('exercises')
      .insert({
        workout_id: wData.id,
        name: exercise.name,
        order_index: i,
        superset_group: exercise.supersetGroup || null,
      })
      .select('id')
      .single()

    if (eError || !eData) { console.error('saveExercise:', eError); continue }

    const dbSets: Record<string, unknown>[] = []
    let setNum = 1
    for (const s of logged) {
      if ((s.type === 'dropset' || s.type === 'halfrep') && s.dropEntries?.length) {
        for (const entry of s.dropEntries) {
          dbSets.push({ exercise_id: eData.id, set_number: setNum++, reps: entry.reps || null, weight: entry.weight || null, set_type: s.type, logged_at: s.loggedAt ? new Date(s.loggedAt).toISOString() : null })
        }
      } else {
        dbSets.push({ exercise_id: eData.id, set_number: setNum++, reps: s.reps || null, weight: s.weight || null, set_type: s.type, logged_at: s.loggedAt ? new Date(s.loggedAt).toISOString() : null })
      }
    }
    await sb.from('sets').insert(dbSets)
  }

  // Award points to groups after saving
  await awardWorkoutPoints(userId)

  return wData.id
}

export async function fetchWorkoutHistory(userId: string, limit = 20): Promise<WorkoutWithExercises[]> {
  const { data: workouts, error } = await (getSupabase() as any)
    .from('workouts')
    .select(`*, exercises (*, sets (*))`)
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) return []

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
    .maybeSingle()   // won't 406 when there are no workouts yet

  return { weeklyCount, weeklySeconds, lastWorkout: lastData || null }
}

// ── Last exercise session (for progressive overload reference) ────────────────

export interface LastSessionData {
  workoutDate: string
  sets: { set_number: number; weight: string | null; reps: string | null; set_type: string }[]
}

export async function fetchLastExerciseSession(
  exerciseName: string,
  userId: string,
  excludeWorkoutId?: string
): Promise<LastSessionData | null> {
  const sb = getSupabase() as any

  // Find the most recent finished workout for this user that had this exercise
  const { data } = await sb
    .from('workouts')
    .select('id, started_at, exercises!inner(id, name, sets(set_number, weight, reps, set_type))')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .ilike('exercises.name', exerciseName.trim())
    .order('started_at', { ascending: false })
    .limit(5)
    // no .single() — returns array, safe when empty

  if (!data || data.length === 0) return null

  // Pick the first result that isn't the current workout
  const match = data.find((w: any) => w.id !== excludeWorkoutId)
  if (!match) return null

  // Get the exercise data from the nested exercises array
  const exercise = Array.isArray(match.exercises)
    ? match.exercises.find((e: any) => e.name.toLowerCase() === exerciseName.toLowerCase())
      ?? match.exercises[0]
    : match.exercises

  if (!exercise) return null

  const sets = (exercise.sets || []).sort((a: any, b: any) => a.set_number - b.set_number)

  return {
    workoutDate: match.started_at,
    sets,
  }
}

// ── Battle groups ─────────────────────────────────────────────────────────────

export interface BattleGroup {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface GroupMember {
  user_id: string
  username: string
  weeklyWorkouts: number
  totalWorkouts: number
  points: number
}

export async function fetchUserGroups(userId: string): Promise<BattleGroup[]> {
  const { data } = await (getSupabase() as any)
    .from('group_members')
    .select('battle_groups(*)')
    .eq('user_id', userId)

  if (!data) return []
  return data.map((row: any) => row.battle_groups).filter(Boolean)
}

export async function createBattleGroup(name: string, userId: string, userEmail?: string): Promise<BattleGroup | null> {
  if (userEmail) await ensureProfile(userId, userEmail)

  const { data, error } = await (getSupabase() as any)
    .from('battle_groups')
    .insert({ name, created_by: userId })
    .select()
    .single()

  if (error) { console.error('createGroup:', error); return null }

  // Auto-join the creator
  await (getSupabase() as any)
    .from('group_members')
    .insert({ group_id: data.id, user_id: userId })

  return data
}

export async function joinBattleGroup(inviteCode: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase() as any

  const { data: group } = await sb
    .from('battle_groups')
    .select('id')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .single()

  if (!group) return { success: false, error: 'Invalid invite code' }

  const { error } = await sb
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Already in this group' }
    return { success: false, error: 'Failed to join group' }
  }

  return { success: true }
}

export async function leaveGroup(groupId: string, userId: string) {
  return (getSupabase() as any)
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
}

export async function fetchGroupLeaderboard(groupId: string): Promise<GroupMember[]> {
  const sb = getSupabase() as any
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get all members with their profiles
  const { data: members } = await sb
    .from('group_members')
    .select('user_id, profiles(username)')
    .eq('group_id', groupId)

  if (!members || members.length === 0) return []

  // For each member, get workout counts in parallel
  const scores = await Promise.all(
    members.map(async (m: any) => {
      const uid = m.user_id
      const username = m.profiles?.username || uid.slice(0, 8)

      const [{ count: weekly }, { count: total }] = await Promise.all([
        sb.from('workouts').select('*', { count: 'exact', head: true })
          .eq('user_id', uid).not('finished_at', 'is', null).gte('started_at', weekAgo),
        sb.from('workouts').select('*', { count: 'exact', head: true })
          .eq('user_id', uid).not('finished_at', 'is', null),
      ])

      const weeklyWorkouts = weekly ?? 0
      const totalWorkouts = total ?? 0

      // Scoring: +10 per workout this week, +15 if 3+ workouts (consistency), +5 per extra workout above 3
      let points = weeklyWorkouts * 10
      if (weeklyWorkouts >= 3) points += 15
      if (weeklyWorkouts >= 5) points += 10

      return { user_id: uid, username, weeklyWorkouts, totalWorkouts, points }
    })
  )

  return scores.sort((a, b) => b.points - a.points)
}

// ── Import historical workout (from text log) ─────────────────────────────────

export async function importHistoricalWorkout(
  exercises: import('@/lib/parseWorkout').ParsedExercise[],
  userId: string,
  userEmail: string | undefined,
  startedAt: Date,
): Promise<boolean> {
  const sb = getSupabase() as any
  if (userEmail) await ensureProfile(userId, userEmail)

  const finishedAt = new Date(startedAt.getTime() + 60 * 60 * 1000)
  const { data: wData, error: wError } = await sb
    .from('workouts')
    .insert({ user_id: userId, started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_seconds: 3600, notes: null })
    .select('id')
    .single()

  if (wError || !wData) { console.error('importHistoricalWorkout:', wError); return false }

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]
    if (!ex.sets.length) continue
    const { data: eData, error: eError } = await sb
      .from('exercises')
      .insert({ workout_id: wData.id, name: ex.name, order_index: i })
      .select('id')
      .single()
    if (eError || !eData) continue

    const dbSets: Record<string, unknown>[] = []
    let setNum = 1
    for (const s of ex.sets) {
      if ((s.type === 'dropset' || s.type === 'halfrep') && s.dropEntries?.length) {
        for (const entry of s.dropEntries) {
          dbSets.push({ exercise_id: eData.id, set_number: setNum++, reps: entry.reps || null, weight: entry.weight || null, set_type: s.type, logged_at: startedAt.toISOString() })
        }
      } else {
        dbSets.push({ exercise_id: eData.id, set_number: setNum++, reps: s.reps || null, weight: s.weight || null, set_type: s.type, logged_at: startedAt.toISOString() })
      }
    }
    await sb.from('sets').insert(dbSets)
  }

  await awardWorkoutPoints(userId)
  return true
}

// Award points hook — called after saving a workout (currently just a log, scores computed live)
async function awardWorkoutPoints(_userId: string) {
  // Scores are computed dynamically from workouts — nothing to store
}
