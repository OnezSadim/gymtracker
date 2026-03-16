'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Clock, Dumbbell, Calendar } from 'lucide-react'
import { fetchWorkoutHistory } from '@/lib/supabase'
import type { WorkoutWithExercises } from '@/types/workout'
import type { User } from '@supabase/supabase-js'

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
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).toUpperCase()
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Workout Card ──────────────────────────────────────────────────────────────

function WorkoutCard({ workout }: { workout: WorkoutWithExercises }) {
  const [expanded, setExpanded] = useState(false)

  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0)
  const exerciseNames = workout.exercises.map(e => e.name)

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            color: 'var(--text-2)',
            letterSpacing: '0.08em',
          }}>
            {formatDate(workout.started_at)} · {formatTime(workout.started_at)}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-3)' }}>
              {formatDuration(workout.duration_seconds)}
            </span>
            {expanded ? <ChevronUp size={14} color="var(--text-3)" /> : <ChevronDown size={14} color="var(--text-3)" />}
          </div>
        </div>

        {/* Exercise names preview */}
        <div style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: 16,
          color: 'var(--text)',
          letterSpacing: '0.05em',
          lineHeight: 1.3,
        }}>
          {exerciseNames.slice(0, 3).join(' · ')}
          {exerciseNames.length > 3 && ` +${exerciseNames.length - 3}`}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 12,
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Dumbbell size={11} />
            {workout.exercises.length} exercises
          </span>
          <span style={{
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 12,
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Clock size={11} />
            {totalSets} sets
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 16px' }}>
          {workout.exercises.map((exercise) => (
            <div key={exercise.id} style={{ marginBottom: 16 }}>
              {/* Exercise name */}
              <div style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: 15,
                color: 'var(--text)',
                letterSpacing: '0.06em',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {exercise.name}
                {exercise.superset_group && (
                  <span style={{
                    fontFamily: 'var(--font-jetbrains)',
                    fontSize: 9,
                    color: '#6366f1',
                    background: 'rgba(99,102,241,0.12)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    letterSpacing: '0.05em',
                  }}>SS</span>
                )}
              </div>

              {/* Sets table */}
              <div style={{
                background: 'var(--surface-2)',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 1fr 1fr',
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {['#', 'KG', 'REPS', 'TYPE'].map(h => (
                    <span key={h} style={{
                      fontFamily: 'var(--font-jetbrains)',
                      fontSize: 9,
                      color: 'var(--text-3)',
                      letterSpacing: '0.1em',
                    }}>{h}</span>
                  ))}
                </div>

                {exercise.sets.map((set, i) => (
                  <div
                    key={set.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr 1fr 1fr',
                      padding: '7px 10px',
                      borderBottom: i < exercise.sets.length - 1 ? '1px solid rgba(44,44,44,0.5)' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-3)' }}>{set.set_number}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: 'var(--text)' }}>{set.weight || '—'}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 13, color: 'var(--text)' }}>{set.reps || '—'}</span>
                    <span style={{
                      fontFamily: 'var(--font-jetbrains)',
                      fontSize: 10,
                      color: set.set_type === 'warmup' ? 'var(--warning)'
                        : set.set_type === 'dropset' ? '#6366f1'
                        : set.set_type === 'failure' ? 'var(--danger)'
                        : 'var(--text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {set.set_type}
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

// ── HistoryPage ───────────────────────────────────────────────────────────────

interface HistoryPageProps {
  user: User | null
}

export default function HistoryPage({ user }: HistoryPageProps) {
  const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user || loaded) return
    setLoading(true)
    fetchWorkoutHistory(user.id)
      .then(setWorkouts)
      .finally(() => { setLoading(false); setLoaded(true) })
  }, [user, loaded])

  if (!user) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        textAlign: 'center',
      }}>
        <Calendar size={40} color="var(--text-3)" />
        <h2 style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: 24,
          color: 'var(--text-2)',
          letterSpacing: '0.08em',
        }}>
          SIGN IN TO VIEW HISTORY
        </h2>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Your workout history lives in the middle tab
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <h1 style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: 28,
          letterSpacing: '0.1em',
          color: 'var(--text)',
        }}>
          HISTORY
        </h1>
      </div>

      {/* List */}
      <div className="page-scroll" style={{ flex: 1, padding: '12px 14px 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>
            Loading...
          </div>
        )}

        {!loading && workouts.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 32px',
            gap: 12,
            textAlign: 'center',
          }}>
            <Dumbbell size={40} color="var(--text-3)" />
            <h3 style={{ fontFamily: 'var(--font-bebas)', fontSize: 22, color: 'var(--text-2)', letterSpacing: '0.08em' }}>
              NO WORKOUTS YET
            </h3>
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
              Finish your first workout to see it here
            </p>
          </div>
        )}

        {workouts.map(workout => (
          <WorkoutCard key={workout.id} workout={workout} />
        ))}
      </div>
    </div>
  )
}
