'use client'

import {
  useState, useEffect, useRef, useCallback,
  type KeyboardEvent, type ChangeEvent,
} from 'react'
import { Plus, X, ChevronDown, ChevronUp, Link2, Link2Off, CheckCircle2, Dumbbell } from 'lucide-react'
import type { ActiveWorkout, Exercise, WorkoutSet, SetType } from '@/types/workout'
import { saveWorkout } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// ── Constants ─────────────────────────────────────────────────────────────────

const SET_TYPE_CONFIG: Record<SetType, { label: string; color: string; bg: string }> = {
  normal:  { label: 'N',  color: '#888',    bg: '#1E1E1E' },
  warmup:  { label: 'W',  color: '#FFAA00', bg: 'rgba(255,170,0,0.12)' },
  dropset: { label: 'D',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  failure: { label: 'F',  color: '#FF4444', bg: 'rgba(255,68,68,0.12)' },
}
const SET_TYPE_ORDER: SetType[] = ['normal', 'warmup', 'dropset', 'failure']

const SUPERSET_COLORS = ['#6366f1', '#ec4899', '#f97316', '#14b8a6', '#f59e0b', '#8b5cf6']

const REST_SUGGESTIONS: Record<SetType, number> = {
  normal:  90,
  warmup:  45,
  dropset: 30,
  failure: 120,
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatRest(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function makeEmptySet(): WorkoutSet {
  return { id: uid(), reps: '', weight: '', type: 'normal', logged: false }
}

function makeExercise(name: string): Exercise {
  return { id: uid(), name, sets: [makeEmptySet()] }
}

// ── Rest Timer component ──────────────────────────────────────────────────────

function RestTimer({ lastLoggedAt, suggestedSeconds }: {
  lastLoggedAt: number | null
  suggestedSeconds: number
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!lastLoggedAt) return
    const update = () => setElapsed(Date.now() - lastLoggedAt)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastLoggedAt])

  if (!lastLoggedAt) return null

  const elapsedS = Math.floor(elapsed / 1000)
  const ratio = elapsedS / suggestedSeconds
  let color = 'var(--success)'
  if (ratio >= 1.3) color = 'var(--danger)'
  else if (ratio >= 1.0) color = 'var(--warning)'

  return (
    <div
      style={{
        margin: '0 16px 8px',
        padding: '8px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-jetbrains)',
          fontSize: 11,
          color: 'var(--text-2)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 3,
        }}>
          Rest
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 28,
            color,
            letterSpacing: '0.03em',
            lineHeight: 1,
          }}>
            {formatRest(elapsed)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
            / {suggestedSeconds}s suggested
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{
        width: 60,
        height: 4,
        background: 'var(--surface-2)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, ratio * 100)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 1s linear, background 0.3s',
        }} />
      </div>
    </div>
  )
}

// ── Set Row ───────────────────────────────────────────────────────────────────

function SetRow({
  set, index, onUpdate, onLog, onRemove, isLast, weightRef,
}: {
  set: WorkoutSet
  index: number
  onUpdate: (updates: Partial<WorkoutSet>) => void
  onLog: () => void
  onRemove: () => void
  isLast: boolean
  weightRef?: (el: HTMLInputElement | null) => void
}) {
  const tc = SET_TYPE_CONFIG[set.type]
  const repsRef = useRef<HTMLInputElement>(null)

  const cycleType = () => {
    const i = SET_TYPE_ORDER.indexOf(set.type)
    onUpdate({ type: SET_TYPE_ORDER[(i + 1) % SET_TYPE_ORDER.length] })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, field: 'weight' | 'reps') => {
    if (e.key === 'Enter') {
      if (field === 'weight') {
        repsRef.current?.focus()
      } else {
        onLog()
      }
    }
  }

  return (
    <div
      className={isLast ? '' : 'set-appear'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 0',
        opacity: set.logged ? 0.55 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Set number */}
      <span style={{
        fontFamily: 'var(--font-jetbrains)',
        fontSize: 12,
        color: 'var(--text-3)',
        width: 18,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        {index + 1}
      </span>

      {/* Type badge */}
      <button
        className="type-badge"
        style={{ color: tc.color, background: tc.bg, border: `1px solid ${tc.color}30` }}
        onClick={cycleType}
        title="Tap to change set type"
      >
        {tc.label}
      </button>

      {/* Weight */}
      <div style={{
        flex: 1,
        background: 'var(--surface-2)',
        borderRadius: 7,
        border: '1px solid var(--border)',
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <input
          ref={weightRef}
          type="text"
          inputMode="decimal"
          value={set.weight}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate({ weight: e.target.value })}
          onKeyDown={(e) => handleKeyDown(e, 'weight')}
          placeholder="kg"
          disabled={set.logged}
          style={{
            width: '100%',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 14,
            color: 'var(--text)',
            background: 'transparent',
          }}
        />
      </div>

      {/* Reps */}
      <div style={{
        flex: 1,
        background: 'var(--surface-2)',
        borderRadius: 7,
        border: '1px solid var(--border)',
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <input
          ref={repsRef}
          type="text"
          inputMode="decimal"
          value={set.reps}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate({ reps: e.target.value })}
          onKeyDown={(e) => handleKeyDown(e, 'reps')}
          placeholder="reps"
          disabled={set.logged}
          style={{
            width: '100%',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 14,
            color: 'var(--text)',
            background: 'transparent',
          }}
        />
      </div>

      {/* Log / Remove */}
      {set.logged ? (
        <CheckCircle2
          size={22}
          className="check-pop"
          style={{ color: 'var(--accent)', flexShrink: 0, filter: 'drop-shadow(0 0 4px var(--accent-glow))' }}
        />
      ) : (
        <button
          onClick={onLog}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1.5px solid var(--accent)',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          <CheckCircle2 size={16} />
        </button>
      )}

      {/* Delete */}
      <button
        onClick={onRemove}
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  index,
  totalExercises,
  onUpdate,
  onRemove,
  onAddSet,
  onLogSet,
  onUpdateSet,
  onRemoveSet,
  onToggleSuperset,
  supersetColor,
}: {
  exercise: Exercise
  index: number
  totalExercises: number
  onUpdate: (updates: Partial<Exercise>) => void
  onRemove: () => void
  onAddSet: () => void
  onLogSet: (setId: string) => void
  onUpdateSet: (setId: string, updates: Partial<WorkoutSet>) => void
  onRemoveSet: (setId: string) => void
  onToggleSuperset: () => void
  supersetColor?: string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const firstWeightRef = useRef<HTMLInputElement | null>(null)

  const loggedCount = exercise.sets.filter(s => s.logged).length

  return (
    <div
      className="card-appear"
      style={{
        background: 'var(--surface)',
        borderRadius: 14,
        border: `1px solid ${supersetColor ? supersetColor + '44' : 'var(--border)'}`,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 8,
        borderLeft: supersetColor ? `3px solid ${supersetColor}` : undefined,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px 10px 14px',
          gap: 8,
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        }}
      >
        {/* Exercise name */}
        <input
          value={exercise.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={{
            flex: 1,
            fontFamily: 'var(--font-bebas)',
            fontSize: 18,
            color: 'var(--text)',
            letterSpacing: '0.06em',
            background: 'transparent',
          }}
          placeholder="EXERCISE NAME"
        />

        {/* Logged badge */}
        {loggedCount > 0 && (
          <span style={{
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 10,
            color: 'var(--accent)',
            background: 'var(--accent-dim)',
            padding: '2px 7px',
            borderRadius: 5,
            flexShrink: 0,
          }}>
            {loggedCount}/{exercise.sets.length}
          </span>
        )}

        {/* Superset toggle */}
        <button
          onClick={onToggleSuperset}
          title={exercise.supersetGroup ? 'Remove from superset' : 'Mark as superset'}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: exercise.supersetGroup ? supersetColor + '22' : 'transparent',
            color: exercise.supersetGroup ? supersetColor : 'var(--text-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {exercise.supersetGroup ? <Link2 size={13} /> : <Link2Off size={13} />}
        </button>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            width: 28, height: 28, borderRadius: 7,
            border: 'none', background: 'transparent',
            color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>

        {/* Remove exercise */}
        <button
          onClick={onRemove}
          style={{
            width: 28, height: 28, borderRadius: 7,
            border: 'none', background: 'transparent',
            color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Sets */}
      {!collapsed && (
        <div style={{ padding: '6px 12px 10px' }}>
          {/* Column headers */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '0 0 4px',
            marginBottom: 2,
          }}>
            <span style={{ width: 18, flexShrink: 0 }} />
            <span style={{ width: 22, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>KG</span>
            <span style={{ flex: 1, fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>REPS</span>
            <span style={{ width: 34, flexShrink: 0 }} />
            <span style={{ width: 26, flexShrink: 0 }} />
          </div>

          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              set={set}
              index={i}
              isLast={i === exercise.sets.length - 1}
              onUpdate={(updates) => onUpdateSet(set.id, updates)}
              onLog={() => onLogSet(set.id)}
              onRemove={() => onRemoveSet(set.id)}
              weightRef={i === 0 ? (el) => { firstWeightRef.current = el } : undefined}
            />
          ))}

          {/* Add set */}
          <button
            onClick={onAddSet}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: 8,
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 13,
              letterSpacing: '0.02em',
            }}
          >
            <Plus size={14} />
            Add Set
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main WorkoutPage ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'gymtracker_active_workout'

interface WorkoutPageProps {
  user: User | null
  onWorkoutStatusChange?: (active: boolean) => void
}

export default function WorkoutPage({ user, onWorkoutStatusChange }: WorkoutPageProps) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tick, setTick] = useState(0)
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null)
  const [suggestedRest, setSuggestedRest] = useState(90)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setWorkout(JSON.parse(saved))
    } catch {}
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (workout) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workout))
      onWorkoutStatusChange?.(true)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      onWorkoutStatusChange?.(false)
    }
  }, [workout, onWorkoutStatusChange])

  // Workout duration ticker
  useEffect(() => {
    if (!workout) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [workout])

  // Focus add-exercise input
  useEffect(() => {
    if (showAddExercise) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [showAddExercise])

  const startWorkout = useCallback(() => {
    setWorkout({
      id: uid(),
      startedAt: Date.now(),
      exercises: [],
      notes: '',
    })
    setSaved(false)
    setShowAddExercise(true)
  }, [])

  const updateWorkout = useCallback((updater: (w: ActiveWorkout) => ActiveWorkout) => {
    setWorkout(prev => prev ? updater(prev) : prev)
  }, [])

  const addExercise = useCallback(() => {
    const name = newExerciseName.trim()
    if (!name) return
    updateWorkout(w => ({ ...w, exercises: [...w.exercises, makeExercise(name)] }))
    setNewExerciseName('')
    setShowAddExercise(false)
  }, [newExerciseName, updateWorkout])

  const removeExercise = useCallback((id: string) => {
    updateWorkout(w => ({ ...w, exercises: w.exercises.filter(e => e.id !== id) }))
  }, [updateWorkout])

  const updateExercise = useCallback((id: string, updates: Partial<Exercise>) => {
    updateWorkout(w => ({
      ...w,
      exercises: w.exercises.map(e => e.id === id ? { ...e, ...updates } : e),
    }))
  }, [updateWorkout])

  const addSet = useCallback((exerciseId: string) => {
    updateWorkout(w => ({
      ...w,
      exercises: w.exercises.map(e =>
        e.id === exerciseId
          ? { ...e, sets: [...e.sets, makeEmptySet()] }
          : e
      ),
    }))
  }, [updateWorkout])

  const logSet = useCallback((exerciseId: string, setId: string) => {
    const now = Date.now()
    updateWorkout(w => {
      const exercise = w.exercises.find(e => e.id === exerciseId)
      const set = exercise?.sets.find(s => s.id === setId)
      if (set) {
        setSuggestedRest(REST_SUGGESTIONS[set.type])
        setLastLoggedAt(now)
      }
      return {
        ...w,
        exercises: w.exercises.map(e =>
          e.id === exerciseId
            ? {
                ...e,
                sets: e.sets.map(s =>
                  s.id === setId
                    ? { ...s, logged: true, loggedAt: now }
                    : s
                ),
              }
            : e
        ),
      }
    })
    // Auto-add next set
    updateWorkout(w => {
      const exercise = w.exercises.find(e => e.id === exerciseId)
      if (!exercise) return w
      const allLogged = exercise.sets.every(s => s.id === setId ? true : s.logged)
      if (allLogged) {
        return {
          ...w,
          exercises: w.exercises.map(e =>
            e.id === exerciseId ? { ...e, sets: [...e.sets, makeEmptySet()] } : e
          ),
        }
      }
      return w
    })
  }, [updateWorkout])

  const updateSet = useCallback((exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => {
    updateWorkout(w => ({
      ...w,
      exercises: w.exercises.map(e =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...updates } : s) }
          : e
      ),
    }))
  }, [updateWorkout])

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    updateWorkout(w => ({
      ...w,
      exercises: w.exercises.map(e =>
        e.id === exerciseId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e
      ),
    }))
  }, [updateWorkout])

  // Superset: assign same group ID to consecutive exercises, or remove
  const toggleSuperset = useCallback((exerciseId: string) => {
    updateWorkout(w => {
      const idx = w.exercises.findIndex(e => e.id === exerciseId)
      const exercise = w.exercises[idx]
      if (!exercise) return w

      if (exercise.supersetGroup) {
        // Remove from superset
        return {
          ...w,
          exercises: w.exercises.map(e =>
            e.supersetGroup === exercise.supersetGroup ? { ...e, supersetGroup: undefined } : e
          ),
        }
      } else {
        // Create new group or join adjacent
        const prev = idx > 0 ? w.exercises[idx - 1] : null
        const next = idx < w.exercises.length - 1 ? w.exercises[idx + 1] : null
        const adjacentGroup = prev?.supersetGroup || next?.supersetGroup
        const groupId = adjacentGroup || uid()

        return {
          ...w,
          exercises: w.exercises.map((e, i) => {
            if (e.id === exerciseId) return { ...e, supersetGroup: groupId }
            if (adjacentGroup && e.supersetGroup === adjacentGroup) return e
            return e
          }),
        }
      }
    })
  }, [updateWorkout])

  const finishWorkout = useCallback(async () => {
    if (!workout || !user) return
    setSaving(true)
    try {
      await saveWorkout(workout, user.id)
      setWorkout(null)
      setLastLoggedAt(null)
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [workout, user])

  // Build superset color map
  const supersetColorMap = new Map<string, string>()
  let colorIdx = 0
  workout?.exercises.forEach(e => {
    if (e.supersetGroup && !supersetColorMap.has(e.supersetGroup)) {
      supersetColorMap.set(e.supersetGroup, SUPERSET_COLORS[colorIdx % SUPERSET_COLORS.length])
      colorIdx++
    }
  })

  // ── Render: no active workout ────────────────────────────────────────────────
  if (!workout) {
    return (
      <div
        className="page-scroll"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 24,
        }}
      >
        {saved && (
          <div style={{
            position: 'absolute',
            top: 60,
            left: 16,
            right: 16,
            padding: '12px 16px',
            background: 'rgba(0,255,136,0.1)',
            border: '1px solid rgba(0,255,136,0.3)',
            borderRadius: 12,
            textAlign: 'center',
            color: 'var(--success)',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 14,
          }}>
            Workout saved!
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <Dumbbell
            size={56}
            color="var(--text-3)"
            style={{ marginBottom: 16 }}
          />
          <h2 style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 32,
            color: 'var(--text-2)',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}>
            No Active Workout
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Start a new session to track your lifts
          </p>
        </div>

        <button
          onClick={startWorkout}
          style={{
            padding: '16px 48px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 14,
            fontFamily: 'var(--font-bebas)',
            fontSize: 22,
            color: '#0A0A0A',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: '0 0 30px var(--accent-glow)',
          }}
        >
          START WORKOUT
        </button>
      </div>
    )
  }

  // ── Render: active workout ───────────────────────────────────────────────────
  const duration = Date.now() - workout.startedAt
  const totalLogged = workout.exercises.reduce((sum, e) => sum + e.sets.filter(s => s.logged).length, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <div style={{
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 11,
              color: 'var(--text-3)',
              letterSpacing: '0.12em',
              marginBottom: 2,
            }}>
              WORKOUT IN PROGRESS
            </div>
            <div style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 36,
              color: 'var(--accent)',
              letterSpacing: '0.04em',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 8px var(--accent-glow))',
            }}>
              {formatDuration(duration)}
            </div>
          </div>

          <button
            onClick={finishWorkout}
            disabled={saving || totalLogged === 0}
            style={{
              padding: '10px 20px',
              background: totalLogged > 0 ? 'var(--accent)' : 'var(--surface-2)',
              border: 'none',
              borderRadius: 10,
              fontFamily: 'var(--font-bebas)',
              fontSize: 16,
              letterSpacing: '0.08em',
              color: totalLogged > 0 ? '#0A0A0A' : 'var(--text-3)',
              cursor: totalLogged > 0 ? 'pointer' : 'not-allowed',
              boxShadow: totalLogged > 0 ? '0 0 16px var(--accent-glow)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'SAVING...' : 'FINISH'}
          </button>
        </div>

        {totalLogged > 0 && (
          <div style={{
            marginTop: 4,
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            color: 'var(--text-2)',
          }}>
            {totalLogged} set{totalLogged !== 1 ? 's' : ''} logged
          </div>
        )}
      </div>

      {/* Rest timer */}
      <div style={{ flexShrink: 0, paddingTop: 8 }}>
        <RestTimer lastLoggedAt={lastLoggedAt} suggestedSeconds={suggestedRest} />
      </div>

      {/* Scrollable exercises */}
      <div className="page-scroll" style={{ flex: 1, padding: '0 12px 20px' }}>
        {workout.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            totalExercises={workout.exercises.length}
            onUpdate={(updates) => updateExercise(exercise.id, updates)}
            onRemove={() => removeExercise(exercise.id)}
            onAddSet={() => addSet(exercise.id)}
            onLogSet={(setId) => logSet(exercise.id, setId)}
            onUpdateSet={(setId, updates) => updateSet(exercise.id, setId, updates)}
            onRemoveSet={(setId) => removeSet(exercise.id, setId)}
            onToggleSuperset={() => toggleSuperset(exercise.id)}
            supersetColor={exercise.supersetGroup ? supersetColorMap.get(exercise.supersetGroup) : undefined}
          />
        ))}

        {/* Add exercise input */}
        {showAddExercise ? (
          <div style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--accent)',
            padding: '10px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            boxShadow: '0 0 12px var(--accent-dim)',
            marginBottom: 8,
          }}>
            <input
              ref={addInputRef}
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addExercise() }}
              placeholder="Exercise name..."
              style={{
                flex: 1,
                fontFamily: 'var(--font-bebas)',
                fontSize: 18,
                color: 'var(--text)',
                letterSpacing: '0.06em',
              }}
            />
            <button
              onClick={addExercise}
              disabled={!newExerciseName.trim()}
              style={{
                padding: '6px 14px',
                background: newExerciseName.trim() ? 'var(--accent)' : 'var(--surface-2)',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'var(--font-bebas)',
                fontSize: 14,
                color: newExerciseName.trim() ? '#0A0A0A' : 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              ADD
            </button>
            <button
              onClick={() => setShowAddExercise(false)}
              style={{
                width: 28, height: 28, borderRadius: 7, border: 'none',
                background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddExercise(true)}
            style={{
              width: '100%',
              padding: '14px',
              background: 'transparent',
              border: '1.5px dashed var(--border)',
              borderRadius: 14,
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 14,
              marginBottom: 40,
            }}
          >
            <Plus size={16} />
            Add Exercise
          </button>
        )}
      </div>
    </div>
  )
}
