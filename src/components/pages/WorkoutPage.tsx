'use client'

import {
  useState, useEffect, useRef, useCallback,
  type KeyboardEvent, type ChangeEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, ChevronDown, ChevronUp, Link2, Link2Off, CheckCircle2, Dumbbell, History, FileText, Download } from 'lucide-react'
import type { ActiveWorkout, Exercise, WorkoutSet, SetType } from '@/types/workout'
import { saveWorkout, fetchLastExerciseSession, importHistoricalWorkout, fetchUserExerciseNames, type LastSessionData } from '@/lib/supabase'
import { parseWorkoutText, parseWithGemini, parseWithVertexAI, detectDateFromText, type ParsedExercise } from '@/lib/parseWorkout'
import type { User } from '@supabase/supabase-js'

// ── Constants ─────────────────────────────────────────────────────────────────

const SET_TYPE_CONFIG: Record<SetType, { label: string; color: string; bg: string }> = {
  normal:  { label: 'N',  color: '#888',    bg: '#1E1E1E' },
  warmup:  { label: 'W',  color: '#FFAA00', bg: 'rgba(255,170,0,0.12)' },
  dropset: { label: 'D',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  halfrep: { label: 'H',  color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  failure: { label: 'F',  color: '#FF4444', bg: 'rgba(255,68,68,0.12)' },
}
const SET_TYPE_ORDER: SetType[] = ['normal', 'warmup', 'dropset', 'halfrep', 'failure']
const SUPERSET_COLORS = ['#6366f1', '#ec4899', '#f97316', '#14b8a6', '#f59e0b', '#8b5cf6']
const REST_SUGGESTIONS: Record<SetType, number> = {
  normal: 90, warmup: 45, dropset: 30, halfrep: 45, failure: 120,
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function formatRest(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff/7)}w ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function makeEmptySet(): WorkoutSet {
  return { id: uid(), reps: '', weight: '', type: 'normal', logged: false }
}
function makeExercise(name: string): Exercise {
  return { id: uid(), name, sets: [makeEmptySet()] }
}

// ── Rest Timer ────────────────────────────────────────────────────────────────

function RestTimer({ lastLoggedAt, suggestedSeconds }: { lastLoggedAt: number | null; suggestedSeconds: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!lastLoggedAt) return
    const update = () => setElapsed(Date.now() - lastLoggedAt)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastLoggedAt])

  if (!lastLoggedAt) return null

  const ratio = Math.floor(elapsed / 1000) / suggestedSeconds
  const color = ratio >= 1.3 ? 'var(--danger)' : ratio >= 1.0 ? 'var(--warning)' : 'var(--success)'

  return (
    <div style={{ margin: '0 16px 8px', padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Rest</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, color, letterSpacing: '0.03em', lineHeight: 1 }}>{formatRest(elapsed)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>/ {suggestedSeconds}s suggested</span>
        </div>
      </div>
      <div style={{ width: 60, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: color, borderRadius: 2, transition: 'width 1s linear, background 0.3s' }} />
      </div>
    </div>
  )
}

// ── Last Session Panel ────────────────────────────────────────────────────────

function LastSessionPanel({ data }: { data: LastSessionData | null | 'loading' }) {
  const [expanded, setExpanded] = useState(false)

  if (data === 'loading') {
    return (
      <div style={{ padding: '6px 0 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <History size={11} color="var(--text-3)" />
        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em' }}>
          loading last session...
        </span>
      </div>
    )
  }

  if (!data) return null

  const summary = data.sets
    .slice(0, 4)
    .map(s => `${s.weight || '?'}×${s.reps || '?'}`)
    .join('  ')
  const hasMore = data.sets.length > 4

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 4 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left' }}
      >
        <History size={11} color="var(--accent)" style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {relativeDate(data.workoutDate)}
        </span>
        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-2)', flex: 1, marginLeft: 4 }}>
          {summary}{hasMore ? ` +${data.sets.length - 4}` : ''}
        </span>
        {expanded ? <ChevronUp size={11} color="var(--text-3)" /> : <ChevronDown size={11} color="var(--text-3)" />}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {data.sets.map((s) => {
            const tc = SET_TYPE_CONFIG[s.set_type as SetType] ?? SET_TYPE_CONFIG.normal
            return (
              <div key={s.set_number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'var(--surface-2)', borderRadius: 7, opacity: 0.75 }}>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', width: 14 }}>{s.set_number}</span>
                <span className="type-badge" style={{ color: tc.color, background: tc.bg, border: `1px solid ${tc.color}30`, pointerEvents: 'none' }}>{tc.label}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-2)', flex: 1 }}>{s.weight || '—'} kg</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-2)' }}>{s.reps || '—'} reps</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Set Row ───────────────────────────────────────────────────────────────────

function SetRow({ set, index, onUpdate, onLog, onRemove, weightRef }: {
  set: WorkoutSet; index: number
  onUpdate: (u: Partial<WorkoutSet>) => void
  onLog: () => void; onRemove: () => void
  weightRef?: (el: HTMLInputElement | null) => void
}) {
  const tc = SET_TYPE_CONFIG[set.type]
  const repsRef = useRef<HTMLInputElement>(null)
  const isMultiEntry = set.type === 'dropset' || set.type === 'halfrep'

  const cycleType = () => {
    const i = SET_TYPE_ORDER.indexOf(set.type)
    const nextType = SET_TYPE_ORDER[(i + 1) % SET_TYPE_ORDER.length]
    if ((nextType === 'dropset' || nextType === 'halfrep') && !set.dropEntries?.length) {
      onUpdate({ type: nextType, dropEntries: [{ weight: set.weight, reps: set.reps }, { weight: '', reps: '' }] })
    } else if (nextType !== 'dropset' && nextType !== 'halfrep' && set.dropEntries?.length) {
      const first = set.dropEntries[0]
      onUpdate({ type: nextType, weight: first?.weight || set.weight, reps: first?.reps || set.reps, dropEntries: undefined })
    } else {
      onUpdate({ type: nextType })
    }
  }

  // ── Multi-entry (dropset / halfrep) ──
  if (isMultiEntry) {
    const entries = set.dropEntries ?? [{ weight: set.weight, reps: set.reps }]

    const updateEntry = (i: number, u: Partial<{ weight: string; reps: string }>) =>
      onUpdate({ dropEntries: entries.map((e, idx) => idx === i ? { ...e, ...u } : e) })
    const addEntry = () => onUpdate({ dropEntries: [...entries, { weight: '', reps: '' }] })
    const removeEntry = (i: number) => {
      if (entries.length <= 1) return
      onUpdate({ dropEntries: entries.filter((_, idx) => idx !== i) })
    }

    return (
      <div className="set-appear" style={{ display: 'flex', gap: 6, padding: '5px 0', opacity: set.logged ? 0.5 : 1, transition: 'opacity 0.2s', alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-3)', width: 18, textAlign: 'center', flexShrink: 0, paddingTop: 7 }}>{index + 1}</span>
        <button className="type-badge" style={{ color: tc.color, background: tc.bg, border: `1px solid ${tc.color}30`, flexShrink: 0, marginTop: 5 }} onClick={cycleType}>{tc.label}</button>

        <div style={{ flex: 1 }}>
          {entries.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: i < entries.length - 1 ? 4 : 0 }}>
              <span style={{ width: 12, textAlign: 'center', flexShrink: 0, color: tc.color, fontSize: 11 }}>{i > 0 ? '↓' : ''}</span>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 7, border: '1px solid var(--border)', padding: '5px 8px' }}>
                <input
                  ref={i === 0 ? weightRef : undefined}
                  type="text" inputMode="decimal" value={entry.weight}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateEntry(i, { weight: e.target.value })}
                  placeholder="kg" disabled={set.logged}
                  style={{ width: '100%', fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: 'var(--text)', background: 'transparent' }}
                />
              </div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 7, border: '1px solid var(--border)', padding: '5px 8px' }}>
                <input
                  type="text" inputMode="decimal" value={entry.reps}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateEntry(i, { reps: e.target.value })}
                  placeholder="reps" disabled={set.logged}
                  style={{ width: '100%', fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: 'var(--text)', background: 'transparent' }}
                />
              </div>
              {entries.length > 1 && !set.logged && (
                <button onClick={() => removeEntry(i)} style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {!set.logged && (
            <button onClick={addEntry} style={{ marginTop: 5, marginLeft: 18, padding: '2px 8px', background: 'transparent', border: `1px dashed ${tc.color}55`, borderRadius: 5, color: tc.color, fontSize: 10, fontFamily: 'var(--font-jetbrains)', cursor: 'pointer', letterSpacing: '0.05em' }}>
              + drop
            </button>
          )}
        </div>

        {set.logged ? (
          <CheckCircle2 size={22} className="check-pop" style={{ color: 'var(--accent)', flexShrink: 0, filter: 'drop-shadow(0 0 4px var(--accent-glow))', marginTop: 5 }} />
        ) : (
          <button onClick={onLog} style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            <CheckCircle2 size={16} />
          </button>
        )}
        <button onClick={onRemove} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', marginTop: 4 }}>
          <X size={13} />
        </button>
      </div>
    )
  }

  // ── Normal set row ──
  const handleKey = (e: KeyboardEvent<HTMLInputElement>, field: 'weight' | 'reps') => {
    if (e.key === 'Enter') { field === 'weight' ? repsRef.current?.focus() : onLog() }
  }

  return (
    <div className="set-appear" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', opacity: set.logged ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-3)', width: 18, textAlign: 'center', flexShrink: 0 }}>{index + 1}</span>
      <button className="type-badge" style={{ color: tc.color, background: tc.bg, border: `1px solid ${tc.color}30` }} onClick={cycleType}>{tc.label}</button>
      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 7, border: '1px solid var(--border)', padding: '5px 8px' }}>
        <input ref={weightRef} type="text" inputMode="decimal" value={set.weight}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate({ weight: e.target.value })}
          onKeyDown={(e) => handleKey(e, 'weight')} placeholder="kg" disabled={set.logged}
          style={{ width: '100%', fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: 'var(--text)', background: 'transparent' }} />
      </div>
      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 7, border: '1px solid var(--border)', padding: '5px 8px' }}>
        <input ref={repsRef} type="text" inputMode="decimal" value={set.reps}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate({ reps: e.target.value })}
          onKeyDown={(e) => handleKey(e, 'reps')} placeholder="reps" disabled={set.logged}
          style={{ width: '100%', fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: 'var(--text)', background: 'transparent' }} />
      </div>
      {set.logged ? (
        <CheckCircle2 size={22} className="check-pop" style={{ color: 'var(--accent)', flexShrink: 0, filter: 'drop-shadow(0 0 4px var(--accent-glow))' }} />
      ) : (
        <button onClick={onLog} style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <CheckCircle2 size={16} />
        </button>
      )}
      <button onClick={onRemove} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ── Exercise Autocomplete ─────────────────────────────────────────────────────

function ExerciseSuggestions({ query, allNames, currentNames, onSelect }: {
  query: string
  allNames: { name: string; lastUsed: string }[]
  currentNames: Set<string>
  onSelect: (name: string) => void
}) {
  if (!query.trim()) return null

  const q = query.toLowerCase()
  const filtered = allNames
    .filter(s => s.name.toLowerCase().includes(q))
    .slice(0, 7)

  if (filtered.length === 0) return null

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 10, overflow: 'hidden', marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {filtered.map((s, i) => {
        const alreadyIn = currentNames.has(s.name.toLowerCase())
        return (
          <button
            key={i}
            onMouseDown={e => { e.preventDefault(); onSelect(s.name) }}
            style={{ width: '100%', padding: '10px 14px', background: alreadyIn ? 'rgba(200,255,0,0.04)' : 'none', border: 'none', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
          >
            <History size={11} color={alreadyIn ? 'var(--accent)' : 'var(--text-3)'} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-bebas)', fontSize: 16, color: alreadyIn ? 'var(--accent)' : 'var(--text)', letterSpacing: '0.05em' }}>{s.name}</span>
            <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)' }}>
              {alreadyIn ? 'in workout' : relativeDate(s.lastUsed)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, onUpdate, onRemove, onAddSet, onLogSet, onUpdateSet, onRemoveSet, onToggleSuperset, supersetColor, lastSession }: {
  exercise: Exercise
  onUpdate: (u: Partial<Exercise>) => void
  onRemove: () => void; onAddSet: () => void
  onLogSet: (id: string) => void
  onUpdateSet: (id: string, u: Partial<WorkoutSet>) => void
  onRemoveSet: (id: string) => void
  onToggleSuperset: () => void
  supersetColor?: string
  lastSession: LastSessionData | null | 'loading'
}) {
  const [collapsed, setCollapsed] = useState(false)
  const loggedCount = exercise.sets.filter(s => s.logged).length

  return (
    <div className="card-appear" style={{ background: 'var(--surface)', borderRadius: 14, border: `1px solid ${supersetColor ? supersetColor + '44' : 'var(--border)'}`, overflow: 'hidden', position: 'relative', marginBottom: 8, borderLeft: supersetColor ? `3px solid ${supersetColor}` : undefined }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px 10px 14px', gap: 8, borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}>
        <input value={exercise.name} onChange={(e) => onUpdate({ name: e.target.value })}
          style={{ flex: 1, fontFamily: 'var(--font-bebas)', fontSize: 18, color: 'var(--text)', letterSpacing: '0.06em', background: 'transparent' }}
          placeholder="EXERCISE NAME" />
        {loggedCount > 0 && (
          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>
            {loggedCount}/{exercise.sets.length}
          </span>
        )}
        <button onClick={onToggleSuperset} title={exercise.supersetGroup ? 'Remove superset' : 'Link as superset'} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: exercise.supersetGroup ? (supersetColor ?? '') + '22' : 'transparent', color: exercise.supersetGroup ? supersetColor : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {exercise.supersetGroup ? <Link2 size={13} /> : <Link2Off size={13} />}
        </button>
        <button onClick={() => setCollapsed(c => !c)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button onClick={onRemove} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '6px 12px 10px' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', gap: 6, padding: '0 0 4px', marginBottom: 2 }}>
            <span style={{ width: 18, flexShrink: 0 }} />
            <span style={{ width: 22, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>KG</span>
            <span style={{ flex: 1, fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>REPS</span>
            <span style={{ width: 34, flexShrink: 0 }} />
            <span style={{ width: 26, flexShrink: 0 }} />
          </div>

          {exercise.sets.map((set, i) => (
            <SetRow key={set.id} set={set} index={i}
              onUpdate={(u) => onUpdateSet(set.id, u)}
              onLog={() => onLogSet(set.id)}
              onRemove={() => onRemoveSet(set.id)} />
          ))}

          <button onClick={onAddSet} style={{ marginTop: 6, width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>
            <Plus size={14} />Add Set
          </button>

          <LastSessionPanel data={lastSession} />
        </div>
      )}
    </div>
  )
}

// ── Text Log Modal ────────────────────────────────────────────────────────────

type TextLogView = 'input' | 'preview' | 'date'

function TextLogModal({ hasActiveWorkout, onClose, onAddToWorkout, onImportHistory }: {
  hasActiveWorkout: boolean
  onClose: () => void
  onAddToWorkout: (exercises: ParsedExercise[]) => void
  onImportHistory: (exercises: ParsedExercise[], date: Date) => void
}) {
  const [view, setView] = useState<TextLogView>('input')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedExercise[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [importDate, setImportDate] = useState('')

  const [aiMode, setAiMode] = useState<'vertex' | 'gemini' | 'local'>('local')

  useEffect(() => {
    import('@/lib/googleAuth').then(({ isConnected }) => {
      if (isConnected()) { setAiMode('vertex'); return }
      if (localStorage.getItem('gymtracker_gemini_key')) setAiMode('gemini')
    }).catch(() => {
      if (localStorage.getItem('gymtracker_gemini_key')) setAiMode('gemini')
    })
  }, [])

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setParseError('')
    try {
      let result: ParsedExercise[]
      if (aiMode === 'vertex') {
        result = await parseWithVertexAI(text)
      } else if (aiMode === 'gemini') {
        const key = localStorage.getItem('gymtracker_gemini_key')!
        result = await parseWithGemini(text, key)
      } else {
        result = parseWorkoutText(text)
      }
      if (result.length === 0) {
        setParseError("Couldn't find any exercises or sets. Check your format.")
      } else {
        setParsed(result)
        setView('preview')
      }
    } finally {
      setParsing(false)
    }
  }

  const handleGoToDate = () => {
    const detected = detectDateFromText(text)
    setImportDate(detected || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16))
    setView('date')
  }

  const backLabel = view === 'date' ? 'preview' : 'input'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <FileText size={15} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, color: 'var(--text)', letterSpacing: '0.08em', flex: 1 }}>
          {view === 'input' ? 'TEXT LOG' : view === 'preview' ? 'PARSED WORKOUT' : 'IMPORT AS HISTORY'}
        </span>
        {view !== 'input' && (
          <button onClick={() => setView(backLabel as TextLogView)}
            style={{ padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--font-dm-sans)', cursor: 'pointer' }}>
            Back
          </button>
        )}
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 24px' }}>

        {/* ── Input view ── */}
        {view === 'input' && (
          <>
            {aiMode !== 'local' && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(200,255,0,0.06)', border: '1px solid rgba(200,255,0,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.08em' }}>
                  ✦ AI PARSING ACTIVE · {aiMode === 'vertex' ? 'VERTEX AI' : 'GEMINI'}
                </span>
              </div>
            )}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
              placeholder={`Type or paste your workout. Examples:\n\nbench press\n  warmup 60 x 15\n  100 x 8\n  rest 90s\n  100 x 8\n\ndropset 100x8 → 80x10 → 60x12\n\nhalf reps 80 x 20\n\nsquat\n  120 x 5\n  rest 3min\n  120 x 5`}
              style={{ width: '100%', minHeight: 260, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-jetbrains)', fontSize: 13, lineHeight: 1.7, padding: '14px', resize: 'vertical' }}
            />
            {parseError && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 13, fontFamily: 'var(--font-dm-sans)' }}>
                {parseError}
              </div>
            )}
            <button onClick={handleParse} disabled={parsing || !text.trim()}
              style={{ marginTop: 12, width: '100%', padding: '14px', background: text.trim() ? 'var(--accent)' : 'var(--surface-2)', border: 'none', borderRadius: 12, fontFamily: 'var(--font-bebas)', fontSize: 18, letterSpacing: '0.08em', color: text.trim() ? '#0A0A0A' : 'var(--text-3)', cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
              {parsing ? 'PARSING...' : 'PARSE'}
            </button>
          </>
        )}

        {/* ── Preview view ── */}
        {view === 'preview' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {parsed.map((ex, i) => (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 17, color: 'var(--text)', letterSpacing: '0.06em', marginBottom: 8 }}>{ex.name}</div>
                  {ex.sets.map((s, j) => {
                    const tc = SET_TYPE_CONFIG[s.type as SetType] ?? SET_TYPE_CONFIG.normal
                    return (
                      <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderTop: j > 0 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', width: 16 }}>{j + 1}</span>
                        <span className="type-badge" style={{ color: tc.color, background: tc.bg, border: `1px solid ${tc.color}30`, pointerEvents: 'none' }}>{tc.label}</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--text-2)', flex: 1 }}>
                          {s.dropEntries
                            ? s.dropEntries.map(e => `${e.weight}×${e.reps}`).join(' → ')
                            : `${s.weight} kg × ${s.reps} reps`}
                        </span>
                        {s.restBefore != null && (
                          <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)' }}>rest {s.restBefore}s</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => onAddToWorkout(parsed)}
                style={{ width: '100%', padding: '14px', background: 'var(--accent)', border: 'none', borderRadius: 12, fontFamily: 'var(--font-bebas)', fontSize: 17, letterSpacing: '0.08em', color: '#0A0A0A', cursor: 'pointer' }}>
                {hasActiveWorkout ? 'ADD TO CURRENT WORKOUT' : 'START WORKOUT WITH THIS'}
              </button>
              <button onClick={handleGoToDate}
                style={{ width: '100%', padding: '13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontFamily: 'var(--font-bebas)', fontSize: 17, letterSpacing: '0.08em', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Download size={14} />
                SAVE AS PAST WORKOUT
              </button>
            </div>
          </>
        )}

        {/* ── Date pick view ── */}
        {view === 'date' && (
          <>
            <p style={{ color: 'var(--text-2)', fontSize: 14, fontFamily: 'var(--font-dm-sans)', marginBottom: 16, lineHeight: 1.5 }}>
              When did this workout happen?
            </p>
            <input
              type="datetime-local"
              value={importDate}
              onChange={e => setImportDate(e.target.value)}
              max={new Date().toISOString().slice(0, 16)}
              style={{ width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-dm-sans)', fontSize: 15, marginBottom: 16 }}
            />
            <div style={{ marginBottom: 14, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 5 }}>WILL IMPORT</div>
              <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 13, color: 'var(--text-2)' }}>
                {parsed.length} exercise{parsed.length !== 1 ? 's' : ''} · {parsed.reduce((n, e) => n + e.sets.length, 0)} sets total
              </div>
            </div>
            <button onClick={() => importDate && onImportHistory(parsed, new Date(importDate))} disabled={!importDate}
              style={{ width: '100%', padding: '14px', background: importDate ? 'var(--accent)' : 'var(--surface-2)', border: 'none', borderRadius: 12, fontFamily: 'var(--font-bebas)', fontSize: 17, letterSpacing: '0.08em', color: importDate ? '#0A0A0A' : 'var(--text-3)', cursor: importDate ? 'pointer' : 'not-allowed' }}>
              SAVE TO HISTORY
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── WorkoutPage ───────────────────────────────────────────────────────────────

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
  const [importSaved, setImportSaved] = useState(false)
  const [, setTick] = useState(0)
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null)
  const [suggestedRest, setSuggestedRest] = useState(90)
  const [lastSessions, setLastSessions] = useState<Map<string, LastSessionData | null | 'loading'>>(new Map())
  const [textLogOpen, setTextLogOpen] = useState(false)
  const [exerciseNames, setExerciseNames] = useState<{ name: string; lastUsed: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Restore from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) setWorkout(JSON.parse(s))
    } catch {}
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (workout) { localStorage.setItem(STORAGE_KEY, JSON.stringify(workout)); onWorkoutStatusChange?.(true) }
    else { localStorage.removeItem(STORAGE_KEY); onWorkoutStatusChange?.(false) }
  }, [workout, onWorkoutStatusChange])

  // Duration ticker
  useEffect(() => {
    if (!workout) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [workout])

  // Focus add input
  useEffect(() => { if (showAddExercise) setTimeout(() => addInputRef.current?.focus(), 50) }, [showAddExercise])

  // Load exercise name history for autocomplete
  useEffect(() => {
    if (user) fetchUserExerciseNames(user.id).then(setExerciseNames)
  }, [user])

  const fetchLastSession = useCallback(async (exerciseName: string) => {
    if (!user || !exerciseName.trim()) return
    setLastSessions(prev => new Map(prev).set(exerciseName, 'loading'))
    const data = await fetchLastExerciseSession(exerciseName, user.id)
    setLastSessions(prev => new Map(prev).set(exerciseName, data))
  }, [user])

  const startWorkout = useCallback(() => {
    setWorkout({ id: uid(), startedAt: Date.now(), exercises: [], notes: '' })
    setSaved(false)
    setShowAddExercise(true)
    setLastSessions(new Map())
  }, [])

  const updateWorkout = useCallback((updater: (w: ActiveWorkout) => ActiveWorkout) => {
    setWorkout(prev => prev ? updater(prev) : prev)
  }, [])

  const addExerciseByName = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    updateWorkout(w => ({ ...w, exercises: [...w.exercises, makeExercise(trimmed)] }))
    fetchLastSession(trimmed)
    setNewExerciseName('')
    setShowAddExercise(false)
    setShowSuggestions(false)
  }, [updateWorkout, fetchLastSession])

  const addExercise = useCallback(() => {
    addExerciseByName(newExerciseName)
  }, [newExerciseName, addExerciseByName])

  const removeExercise = useCallback((id: string) => {
    updateWorkout(w => ({ ...w, exercises: w.exercises.filter(e => e.id !== id) }))
  }, [updateWorkout])

  const updateExercise = useCallback((id: string, updates: Partial<Exercise>) => {
    updateWorkout(w => ({ ...w, exercises: w.exercises.map(e => e.id === id ? { ...e, ...updates } : e) }))
    if (updates.name) fetchLastSession(updates.name)
  }, [updateWorkout, fetchLastSession])

  const addSet = useCallback((exerciseId: string) => {
    updateWorkout(w => ({ ...w, exercises: w.exercises.map(e => e.id === exerciseId ? { ...e, sets: [...e.sets, makeEmptySet()] } : e) }))
  }, [updateWorkout])

  const logSet = useCallback((exerciseId: string, setId: string) => {
    const now = Date.now()
    updateWorkout(w => {
      const set = w.exercises.find(e => e.id === exerciseId)?.sets.find(s => s.id === setId)
      if (set) { setSuggestedRest(REST_SUGGESTIONS[set.type]); setLastLoggedAt(now) }
      return {
        ...w,
        exercises: w.exercises.map(e =>
          e.id === exerciseId ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, logged: true, loggedAt: now } : s) } : e
        ),
      }
    })
    setTimeout(() => {
      updateWorkout(w => {
        const exercise = w.exercises.find(e => e.id === exerciseId)
        if (!exercise) return w
        const allLogged = exercise.sets.every(s => s.logged)
        if (allLogged) return { ...w, exercises: w.exercises.map(e => e.id === exerciseId ? { ...e, sets: [...e.sets, makeEmptySet()] } : e) }
        return w
      })
    }, 50)
  }, [updateWorkout])

  const updateSet = useCallback((exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => {
    updateWorkout(w => ({ ...w, exercises: w.exercises.map(e => e.id === exerciseId ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...updates } : s) } : e) }))
  }, [updateWorkout])

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    updateWorkout(w => ({ ...w, exercises: w.exercises.map(e => e.id === exerciseId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e) }))
  }, [updateWorkout])

  const toggleSuperset = useCallback((exerciseId: string) => {
    updateWorkout(w => {
      const idx = w.exercises.findIndex(e => e.id === exerciseId)
      const exercise = w.exercises[idx]
      if (!exercise) return w
      if (exercise.supersetGroup) {
        return { ...w, exercises: w.exercises.map(e => e.supersetGroup === exercise.supersetGroup ? { ...e, supersetGroup: undefined } : e) }
      }
      const prev = idx > 0 ? w.exercises[idx - 1] : null
      const next = idx < w.exercises.length - 1 ? w.exercises[idx + 1] : null
      const groupId = prev?.supersetGroup || next?.supersetGroup || uid()
      return { ...w, exercises: w.exercises.map((e, i) => i === idx ? { ...e, supersetGroup: groupId } : e) }
    })
  }, [updateWorkout])

  const finishWorkout = useCallback(async () => {
    if (!workout || !user) return
    setSaving(true)
    try {
      await saveWorkout(workout, user.id, user.email ?? undefined)
      setWorkout(null)
      setLastLoggedAt(null)
      setLastSessions(new Map())
      setSaved(true)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }, [workout, user])

  // ── Text log handlers ────────────────────────────────────────────────────────

  const addParsedToWorkout = useCallback((parsed: ParsedExercise[]) => {
    const newExercises: Exercise[] = parsed.map(pe => ({
      id: uid(),
      name: pe.name,
      sets: pe.sets.map(s => ({
        id: uid(),
        weight: s.dropEntries?.[0]?.weight ?? s.weight,
        reps: s.dropEntries?.[0]?.reps ?? s.reps,
        type: s.type as SetType,
        logged: false,
        dropEntries: s.dropEntries,
      })),
    }))

    if (!workout) {
      setWorkout({ id: uid(), startedAt: Date.now(), exercises: newExercises, notes: '' })
      setSaved(false)
      setLastSessions(new Map())
    } else {
      updateWorkout(w => ({ ...w, exercises: [...w.exercises, ...newExercises] }))
    }
    for (const ex of newExercises) fetchLastSession(ex.name)
    setTextLogOpen(false)
  }, [workout, updateWorkout, fetchLastSession])

  const importToHistory = useCallback(async (parsed: ParsedExercise[], date: Date) => {
    if (!user) return
    setTextLogOpen(false)
    const ok = await importHistoricalWorkout(parsed, user.id, user.email ?? undefined, date)
    if (ok) { setImportSaved(true); setTimeout(() => setImportSaved(false), 4000) }
  }, [user])

  // Superset color map
  const supersetColorMap = new Map<string, string>()
  let colorIdx = 0
  workout?.exercises.forEach(e => {
    if (e.supersetGroup && !supersetColorMap.has(e.supersetGroup)) {
      supersetColorMap.set(e.supersetGroup, SUPERSET_COLORS[colorIdx++ % SUPERSET_COLORS.length])
    }
  })

  // ── No active workout ────────────────────────────────────────────────────────
  if (!workout) {
    return (
      <div className="page-scroll" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 }}>
        {(saved || importSaved) && (
          <div style={{ position: 'absolute', top: 60, left: 16, right: 16, padding: '12px 16px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 12, textAlign: 'center', color: 'var(--success)', fontFamily: 'var(--font-dm-sans)', fontSize: 14 }}>
            {saved ? 'Workout saved! Points awarded 💪' : 'Workout imported to history ✓'}
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <Dumbbell size={56} color="var(--text-3)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: 32, color: 'var(--text-2)', letterSpacing: '0.08em', marginBottom: 8 }}>No Active Workout</h2>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Start a session to track your lifts</p>
        </div>
        <button onClick={startWorkout} style={{ padding: '16px 48px', background: 'var(--accent)', border: 'none', borderRadius: 14, fontFamily: 'var(--font-bebas)', fontSize: 22, color: '#0A0A0A', letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 0 30px var(--accent-glow)' }}>
          START WORKOUT
        </button>
        {user && (
          <button onClick={() => setTextLogOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-2)', fontFamily: 'var(--font-dm-sans)', fontSize: 14, cursor: 'pointer' }}>
            <FileText size={15} />
            Import from text / notes
          </button>
        )}
        {textLogOpen && createPortal(
          <TextLogModal
            hasActiveWorkout={false}
            onClose={() => setTextLogOpen(false)}
            onAddToWorkout={addParsedToWorkout}
            onImportHistory={importToHistory}
          />,
          document.body
        )}
      </div>
    )
  }

  // ── Active workout ───────────────────────────────────────────────────────────
  const duration = Date.now() - workout.startedAt
  const totalLogged = workout.exercises.reduce((sum, e) => sum + e.sets.filter(s => s.logged).length, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 2 }}>WORKOUT IN PROGRESS</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 36, color: 'var(--accent)', letterSpacing: '0.04em', lineHeight: 1, filter: 'drop-shadow(0 0 8px var(--accent-glow))' }}>
              {formatDuration(duration)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setTextLogOpen(true)} style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <FileText size={15} />
            </button>
            <button onClick={finishWorkout} disabled={saving || totalLogged === 0} style={{ padding: '10px 20px', background: totalLogged > 0 ? 'var(--accent)' : 'var(--surface-2)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-bebas)', fontSize: 16, letterSpacing: '0.08em', color: totalLogged > 0 ? '#0A0A0A' : 'var(--text-3)', cursor: totalLogged > 0 ? 'pointer' : 'not-allowed', boxShadow: totalLogged > 0 ? '0 0 16px var(--accent-glow)' : 'none', transition: 'all 0.2s' }}>
              {saving ? 'SAVING...' : 'FINISH'}
            </button>
          </div>
        </div>
        {totalLogged > 0 && <div style={{ marginTop: 4, fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--text-2)' }}>{totalLogged} set{totalLogged !== 1 ? 's' : ''} logged</div>}
      </div>

      {/* Rest timer */}
      <div style={{ flexShrink: 0, paddingTop: 8 }}>
        <RestTimer lastLoggedAt={lastLoggedAt} suggestedSeconds={suggestedRest} />
      </div>

      {/* Exercises */}
      <div className="page-scroll" style={{ flex: 1, padding: '0 12px 20px' }}>
        {workout.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onUpdate={(u) => updateExercise(exercise.id, u)}
            onRemove={() => removeExercise(exercise.id)}
            onAddSet={() => addSet(exercise.id)}
            onLogSet={(id) => logSet(exercise.id, id)}
            onUpdateSet={(id, u) => updateSet(exercise.id, id, u)}
            onRemoveSet={(id) => removeSet(exercise.id, id)}
            onToggleSuperset={() => toggleSuperset(exercise.id)}
            supersetColor={exercise.supersetGroup ? supersetColorMap.get(exercise.supersetGroup) : undefined}
            lastSession={lastSessions.get(exercise.name) ?? null}
          />
        ))}

        {showAddExercise ? (
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--accent)', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 0 12px var(--accent-dim)' }}>
              <input
                ref={addInputRef}
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { addExercise(); setShowSuggestions(false) }
                  if (e.key === 'Escape') { setShowAddExercise(false); setShowSuggestions(false) }
                }}
                placeholder="Exercise name..."
                style={{ flex: 1, fontFamily: 'var(--font-bebas)', fontSize: 18, color: 'var(--text)', letterSpacing: '0.06em' }}
              />
              <button onClick={() => { addExercise(); setShowSuggestions(false) }} disabled={!newExerciseName.trim()} style={{ padding: '6px 14px', background: newExerciseName.trim() ? 'var(--accent)' : 'var(--surface-2)', border: 'none', borderRadius: 8, fontFamily: 'var(--font-bebas)', fontSize: 14, color: newExerciseName.trim() ? '#0A0A0A' : 'var(--text-3)', cursor: 'pointer' }}>ADD</button>
              <button onClick={() => { setShowAddExercise(false); setShowSuggestions(false) }} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            </div>
            {showSuggestions && (
              <ExerciseSuggestions
                query={newExerciseName}
                allNames={exerciseNames}
                currentNames={new Set(workout?.exercises.map(e => e.name.toLowerCase()) ?? [])}
                onSelect={(name) => addExerciseByName(name)}
              />
            )}
          </div>
        ) : (
          <button onClick={() => setShowAddExercise(true)} style={{ width: '100%', padding: '14px', background: 'transparent', border: '1.5px dashed var(--border)', borderRadius: 14, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 14, marginBottom: 16 }}>
            <Plus size={16} />Add Exercise
          </button>
        )}
      </div>

      {textLogOpen && createPortal(
        <TextLogModal
          hasActiveWorkout
          onClose={() => setTextLogOpen(false)}
          onAddToWorkout={addParsedToWorkout}
          onImportHistory={importToHistory}
        />,
        document.body
      )}
    </div>
  )
}
