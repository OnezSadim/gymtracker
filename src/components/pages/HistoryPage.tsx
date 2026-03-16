'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Clock, Dumbbell, Calendar, ArrowLeft, Trophy } from 'lucide-react'
import { fetchWorkoutHistory, fetchExerciseProgress, type ExerciseSessionData } from '@/lib/supabase'
import type { WorkoutWithExercises } from '@/types/workout'
import type { User } from '@supabase/supabase-js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).toUpperCase()
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const TYPE_COLOR: Record<string, string> = {
  warmup: 'var(--warning)', dropset: '#6366f1', failure: 'var(--danger)', halfrep: '#22d3ee',
}

// ── Workout Card ──────────────────────────────────────────────────────────────

function WorkoutCard({ workout }: { workout: WorkoutWithExercises }) {
  const [expanded, setExpanded] = useState(false)
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0)
  const exerciseNames = workout.exercises.map(e => e.name)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.08em' }}>
            {formatDate(workout.started_at)} · {formatTime(workout.started_at)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-3)' }}>{formatDuration(workout.duration_seconds)}</span>
            {expanded ? <ChevronUp size={14} color="var(--text-3)" /> : <ChevronDown size={14} color="var(--text-3)" />}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 16, color: 'var(--text)', letterSpacing: '0.05em', lineHeight: 1.3 }}>
          {exerciseNames.slice(0, 3).join(' · ')}{exerciseNames.length > 3 && ` +${exerciseNames.length - 3}`}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Dumbbell size={11} />{workout.exercises.length} exercises
          </span>
          <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />{totalSets} sets
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 16px' }}>
          {workout.exercises.map((exercise) => (
            <div key={exercise.id} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 15, color: 'var(--text)', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                {exercise.name}
                {exercise.superset_group && (
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '1px 5px', borderRadius: 3 }}>SS</span>
                )}
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr', padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                  {['#', 'KG', 'REPS', 'TYPE'].map(h => (
                    <span key={h} style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{h}</span>
                  ))}
                </div>
                {exercise.sets.map((set, i) => (
                  <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr', padding: '7px 10px', borderBottom: i < exercise.sets.length - 1 ? '1px solid rgba(44,44,44,0.5)' : 'none' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-3)' }}>{set.set_number}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: 'var(--text)' }}>{set.weight || '—'}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: 'var(--text)' }}>{set.reps || '—'}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: TYPE_COLOR[set.set_type] || 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {set.set_type === 'normal' ? '—' : set.set_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Exercise Detail View ──────────────────────────────────────────────────────

function bestSet(sessions: ExerciseSessionData[]): { weight: string; reps: string } | null {
  let best: { w: number; weight: string; reps: string } | null = null
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.set_type === 'warmup') continue
      const w = parseFloat(set.weight || '') || 0
      if (!best || w > best.w) best = { w, weight: set.weight || '—', reps: set.reps || '—' }
    }
  }
  return best ? { weight: best.weight, reps: best.reps } : null
}

function sessionVolume(sets: ExerciseSessionData['sets']): number {
  return sets.reduce((sum, s) => {
    const w = parseFloat(s.weight || '') || 0
    const r = parseFloat(s.reps || '') || 0
    return sum + w * r
  }, 0)
}

function ExerciseDetailView({ name, userId, onBack }: { name: string; userId: string; onBack: () => void }) {
  const [sessions, setSessions] = useState<ExerciseSessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchExerciseProgress(name, userId).then(setSessions).finally(() => setLoading(false))
  }, [name])

  const pr = bestSet(sessions)
  const workingSets = (s: ExerciseSessionData['sets']) => s.filter(x => x.set_type !== 'warmup')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', marginBottom: 10, padding: 0, fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: 26, letterSpacing: '0.08em', color: 'var(--text)', lineHeight: 1, marginBottom: 2 }}>
          {name.toUpperCase()}
        </h1>
        {!loading && (
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em' }}>
            {sessions.length} SESSION{sessions.length !== 1 ? 'S' : ''}
          </div>
        )}
      </div>

      <div className="page-scroll" style={{ flex: 1, padding: '12px 14px 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>Loading...</div>
        )}

        {/* PR card */}
        {pr && (
          <div style={{ background: 'linear-gradient(135deg, rgba(200,255,0,0.08), rgba(200,255,0,0.03))', border: '1px solid rgba(200,255,0,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Trophy size={20} color="var(--accent)" />
            <div>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 3 }}>PERSONAL RECORD</div>
              <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, color: 'var(--accent)', letterSpacing: '0.06em', lineHeight: 1 }}>
                {pr.weight} kg × {pr.reps} reps
              </div>
            </div>
          </div>
        )}

        {/* Sessions */}
        {sessions.map((session, i) => {
          const ws = workingSets(session.sets)
          const maxW = Math.max(...ws.map(s => parseFloat(s.weight || '') || 0))
          const vol = sessionVolume(ws)
          const isExpanded = expanded.has(i)
          const toggle = () => setExpanded(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
          })

          return (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={toggle} style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 4 }}>
                    {relativeDate(session.workoutDate)} · {new Date(session.workoutDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                    {maxW > 0 && (
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, color: 'var(--text)', letterSpacing: '0.04em' }}>{maxW} kg</span>
                    )}
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-2)' }}>
                      {ws.length} set{ws.length !== 1 ? 's' : ''}
                      {vol > 0 && ` · ${Math.round(vol)} kg vol`}
                    </span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={13} color="var(--text-3)" /> : <ChevronDown size={13} color="var(--text-3)" />}
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px 12px' }}>
                  {session.sets.map((set, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: j < session.sets.length - 1 ? '1px solid rgba(44,44,44,0.4)' : 'none' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', width: 18 }}>{set.set_number}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: 'var(--text)', flex: 1 }}>
                        {set.weight || '—'} kg × {set.reps || '—'} reps
                      </span>
                      {set.set_type !== 'normal' && (
                        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: TYPE_COLOR[set.set_type] || 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {set.set_type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {!loading && sessions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>
            No sessions found for this exercise.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Exercise List View ────────────────────────────────────────────────────────

function ExerciseListView({ workouts, onSelect }: {
  workouts: WorkoutWithExercises[]
  onSelect: (name: string) => void
}) {
  // Derive unique exercises from loaded workouts
  const exerciseMap = new Map<string, { name: string; lastUsed: string; sessionCount: number; bestWeight: number }>()
  for (const workout of workouts) {
    for (const ex of workout.exercises) {
      const key = ex.name.toLowerCase()
      const maxW = Math.max(...ex.sets.map(s => parseFloat(s.weight || '') || 0), 0)
      const existing = exerciseMap.get(key)
      if (!existing) {
        exerciseMap.set(key, { name: ex.name, lastUsed: workout.started_at, sessionCount: 1, bestWeight: maxW })
      } else {
        exerciseMap.set(key, { ...existing, sessionCount: existing.sessionCount + 1, bestWeight: Math.max(existing.bestWeight, maxW) })
      }
    }
  }

  const exercises = Array.from(exerciseMap.values())
    .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())

  if (exercises.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', gap: 12, textAlign: 'center' }}>
        <Dumbbell size={40} color="var(--text-3)" />
        <p style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-dm-sans)' }}>No exercises yet</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 14px 32px' }}>
      {exercises.map((ex, i) => (
        <button
          key={i}
          onClick={() => onSelect(ex.name)}
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 17, color: 'var(--text)', letterSpacing: '0.05em', lineHeight: 1.1, marginBottom: 4 }}>{ex.name}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
                {ex.sessionCount} session{ex.sessionCount !== 1 ? 's' : ''}
              </span>
              {ex.bestWeight > 0 && (
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                  best {ex.bestWeight} kg
                </span>
              )}
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)' }}>{relativeDate(ex.lastUsed)}</span>
          <ChevronDown size={13} color="var(--text-3)" style={{ transform: 'rotate(-90deg)' }} />
        </button>
      ))}
    </div>
  )
}

// ── HistoryPage ───────────────────────────────────────────────────────────────

interface HistoryPageProps {
  user: User | null
}

export default function HistoryPage({ user }: HistoryPageProps) {
  const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<'workouts' | 'exercises'>('workouts')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  useEffect(() => {
    if (!user || loaded) return
    setLoading(true)
    fetchWorkoutHistory(user.id)
      .then(setWorkouts)
      .finally(() => { setLoading(false); setLoaded(true) })
  }, [user, loaded])

  if (!user) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, textAlign: 'center' }}>
        <Calendar size={40} color="var(--text-3)" />
        <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: 24, color: 'var(--text-2)', letterSpacing: '0.08em' }}>SIGN IN TO VIEW HISTORY</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Your workout history lives here</p>
      </div>
    )
  }

  // Exercise detail fullscreen
  if (selectedExercise) {
    return (
      <ExerciseDetailView
        name={selectedExercise}
        userId={user.id}
        onBack={() => setSelectedExercise(null)}
      />
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.1em', color: 'var(--text)', marginBottom: 12 }}>HISTORY</h1>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 10, padding: 3, border: '1px solid var(--border)', marginBottom: 12 }}>
          {(['workouts', 'exercises'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: tab === t ? 'var(--surface-3)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text-2)', fontFamily: 'var(--font-dm-sans)', fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.02em' }}
            >
              {t === 'workouts' ? 'Workouts' : 'Exercises'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="page-scroll" style={{ flex: 1 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>Loading...</div>
        )}

        {!loading && tab === 'workouts' && (
          <div style={{ padding: '12px 14px 32px' }}>
            {workouts.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', gap: 12, textAlign: 'center' }}>
                <Dumbbell size={40} color="var(--text-3)" />
                <h3 style={{ fontFamily: 'var(--font-bebas)', fontSize: 22, color: 'var(--text-2)', letterSpacing: '0.08em' }}>NO WORKOUTS YET</h3>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Finish your first workout to see it here</p>
              </div>
            ) : workouts.map(w => <WorkoutCard key={w.id} workout={w} />)}
          </div>
        )}

        {!loading && tab === 'exercises' && (
          <ExerciseListView workouts={workouts} onSelect={setSelectedExercise} />
        )}
      </div>
    </div>
  )
}
