'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, TrendingUp, Clock, LogOut, ChevronRight } from 'lucide-react'
import { signIn, signUp, signOut, fetchRecentStats } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Auth Form ─────────────────────────────────────────────────────────────────

function AuthForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        if (data.user && !data.session) {
          setSignupSuccess(true)
        } else if (data.user) {
          onLogin(data.user)
        }
      } else {
        const { data, error } = await signIn(email, password)
        if (error) throw error
        if (data.user) onLogin(data.user)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (signupSuccess) {
    return (
      <div
        className="fade-up"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          textAlign: 'center',
          gap: 16,
        }}
      >
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(0,255,136,0.1)',
          border: '1px solid rgba(0,255,136,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 28 }}>✓</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.08em', color: 'var(--success)' }}>
          CHECK YOUR EMAIL
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
          We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
          Click it to activate your account.
        </p>
        <button
          onClick={() => { setSignupSuccess(false); setMode('login') }}
          style={{
            marginTop: 8,
            padding: '12px 28px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'var(--text)',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Back to Login
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 28px',
      }}
    >
      {/* Logo */}
      <div className="fade-up-1" style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 0 40px var(--accent-glow)',
        }}>
          <Dumbbell size={32} color="#0A0A0A" strokeWidth={2.5} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: 38,
          letterSpacing: '0.1em',
          color: 'var(--text)',
          lineHeight: 1,
        }}>
          GYMTRACKER
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 6, letterSpacing: '0.05em' }}>
          Track your gains
        </p>
      </div>

      {/* Mode toggle */}
      <div
        className="fade-up-2"
        style={{
          display: 'flex',
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 3,
          marginBottom: 24,
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 320,
        }}
      >
        {(['login', 'signup'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError('') }}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: 9,
              border: 'none',
              background: mode === m ? 'var(--surface-3)' : 'transparent',
              color: mode === m ? 'var(--text)' : 'var(--text-2)',
              fontFamily: 'var(--font-dm-sans)',
              fontWeight: mode === m ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
          >
            {m === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div className="fade-up-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text)',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 15,
            }}
          />
        </div>

        <div className="fade-up-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text)',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 15,
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid rgba(255,68,68,0.3)',
            borderRadius: 10,
            color: 'var(--danger)',
            fontSize: 13,
            fontFamily: 'var(--font-dm-sans)',
          }}>
            {error}
          </div>
        )}

        <div className="fade-up-5">
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 12,
              fontFamily: 'var(--font-bebas)',
              fontSize: 18,
              letterSpacing: '0.1em',
              color: '#0A0A0A',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 0 24px var(--accent-glow)',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? '...' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ user, onStartWorkout, onLogout }: {
  user: User
  onStartWorkout: () => void
  onLogout: () => void
}) {
  const [stats, setStats] = useState<{
    weeklyCount: number
    weeklySeconds: number
    lastWorkout: { started_at: string; exercises: { name: string }[] } | null
  } | null>(null)

  useEffect(() => {
    fetchRecentStats(user.id).then(setStats)
  }, [user.id])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = user.email?.split('@')[0] || 'Athlete'

  return (
    <div className="page-scroll" style={{ height: '100%', padding: '20px 16px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div className="fade-up-1">
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 4 }}>{greeting},</p>
          <h1 style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 36,
            letterSpacing: '0.06em',
            color: 'var(--text)',
            lineHeight: 1,
          }}>
            {displayName.toUpperCase()}
          </h1>
        </div>

        <button
          onClick={onLogout}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <LogOut size={15} />
        </button>
      </div>

      {/* Weekly stats */}
      {stats && (
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <TrendingUp size={14} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                This Week
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 40, color: 'var(--accent)', lineHeight: 1, letterSpacing: '0.04em' }}>
              {stats.weeklyCount}
            </div>
            <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              workout{stats.weeklyCount !== 1 ? 's' : ''}
            </div>
          </div>

          <div style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Clock size={14} color="var(--text-2)" />
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Total Time
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 40, color: 'var(--text)', lineHeight: 1, letterSpacing: '0.04em' }}>
              {stats.weeklySeconds > 0 ? formatHMS(stats.weeklySeconds) : '—'}
            </div>
            <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              this week
            </div>
          </div>
        </div>
      )}

      {/* Last workout */}
      {stats?.lastWorkout && (
        <div className="fade-up-3" style={{
          background: 'var(--surface)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 9,
            color: 'var(--text-3)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Last Workout · {formatDate(stats.lastWorkout.started_at)}
          </div>
          <div style={{
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 14,
            color: 'var(--text-2)',
            lineHeight: 1.5,
          }}>
            {(stats.lastWorkout.exercises as { name: string }[])
              .slice(0, 4)
              .map(e => e.name)
              .join(', ')}
            {(stats.lastWorkout.exercises as { name: string }[]).length > 4 && ` +${(stats.lastWorkout.exercises as { name: string }[]).length - 4} more`}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="fade-up-4">
        <button
          onClick={onStartWorkout}
          style={{
            width: '100%',
            padding: '18px 24px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 0 30px var(--accent-glow)',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 22,
              color: '#0A0A0A',
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}>
              START WORKOUT
            </div>
            <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginTop: 3 }}>
              Tap to begin tracking
            </div>
          </div>
          <ChevronRight size={22} color="#0A0A0A" />
        </button>
      </div>
    </div>
  )
}

// ── HomePage (exported) ───────────────────────────────────────────────────────

interface HomePageProps {
  user: User | null
  onLogin: (user: User) => void
  onLogout: () => void
  onNavigateToWorkout: () => void
}

export default function HomePage({ user, onLogin, onLogout, onNavigateToWorkout }: HomePageProps) {
  const handleLogout = async () => {
    await signOut()
    onLogout()
  }

  if (!user) {
    return <AuthForm onLogin={onLogin} />
  }

  return (
    <Dashboard
      user={user}
      onStartWorkout={onNavigateToWorkout}
      onLogout={handleLogout}
    />
  )
}
