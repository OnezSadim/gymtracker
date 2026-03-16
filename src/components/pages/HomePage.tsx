'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Dumbbell, TrendingUp, Clock, LogOut, ChevronRight, Settings, X, Eye, EyeOff } from 'lucide-react'
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

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [projectId,    setProjectId]    = useState('')
  const [clientId,     setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret,   setShowSecret]   = useState(false)
  const [geminiKey,    setGeminiKey]    = useState('')
  const [showGemini,   setShowGemini]   = useState(false)
  const [connected,    setConnected]    = useState(false)
  const [email,        setEmail]        = useState('')
  const [connecting,   setConnecting]   = useState(false)
  const [connectError, setConnectError] = useState('')
  const [savedMsg,     setSavedMsg]     = useState('')

  useEffect(() => {
    // Lazy import to avoid SSR issues
    import('@/lib/googleAuth').then(({ loadCredentials, isConnected, connectedEmail }) => {
      const creds = loadCredentials()
      setProjectId(creds.projectId)
      setClientId(creds.clientId)
      setClientSecret(creds.clientSecret)
      setConnected(isConnected())
      setEmail(connectedEmail())
    })
    setGeminiKey(localStorage.getItem('gymtracker_gemini_key') || '')
  }, [])

  const handleSaveCreds = async () => {
    const { saveCredentials } = await import('@/lib/googleAuth')
    saveCredentials({ projectId, clientId, clientSecret })
    setSavedMsg('Credentials saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const handleConnect = async () => {
    if (!clientId || !clientSecret) {
      setConnectError('Enter Client ID and Client Secret first.')
      return
    }
    setConnecting(true)
    setConnectError('')
    const { saveCredentials, connectGoogleAccount, isConnected, connectedEmail } = await import('@/lib/googleAuth')
    saveCredentials({ projectId, clientId, clientSecret })
    const result = await connectGoogleAccount(clientId, clientSecret)
    if (result.ok) {
      setConnected(isConnected())
      setEmail(connectedEmail())
    } else {
      setConnectError(result.error || 'Connection failed.')
    }
    setConnecting(false)
  }

  const handleDisconnect = async () => {
    const { disconnect } = await import('@/lib/googleAuth')
    disconnect()
    setConnected(false)
    setEmail('')
  }

  const handleSaveGemini = () => {
    if (geminiKey.trim()) localStorage.setItem('gymtracker_gemini_key', geminiKey.trim())
    else localStorage.removeItem('gymtracker_gemini_key')
    setSavedMsg('Saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 10,
    color: 'var(--text)', fontFamily: 'var(--font-jetbrains)', fontSize: 13,
  } as const

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Settings size={15} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, color: 'var(--text)', letterSpacing: '0.08em', flex: 1 }}>SETTINGS</span>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Google Cloud Vertex AI ── */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 15, color: 'var(--text)', letterSpacing: '0.06em' }}>GOOGLE CLOUD VERTEX AI</div>
            {connected && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-jetbrains)', color: 'var(--success)', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', padding: '2px 7px', borderRadius: 5 }}>CONNECTED</span>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
            AI text parsing via your Google Cloud project (Gemini on Vertex AI).
            Create OAuth credentials at <span style={{ color: 'var(--accent)' }}>console.cloud.google.com → APIs &amp; Services → Credentials</span> (type: Web application, redirect URI: <span style={{ color: 'var(--accent)' }}>{typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback</span>).
          </p>

          {connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-jetbrains)', color: 'var(--text-2)' }}>{email || 'Connected'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', marginTop: 2 }}>Project: {projectId || '—'}</div>
              </div>
              <button onClick={handleDisconnect} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', fontSize: 12, cursor: 'pointer' }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={projectId} onChange={e => setProjectId(e.target.value)} placeholder="GCP Project ID (e.g. my-project-123)" style={inputStyle} />
              <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="OAuth Client ID (…apps.googleusercontent.com)" style={inputStyle} />
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder="OAuth Client Secret (GOCSPX-…)"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button onClick={() => setShowSecret(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {connectError && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, fontFamily: 'var(--font-dm-sans)' }}>
                  {connectError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleConnect} disabled={connecting}
                  style={{ flex: 1, padding: '11px', background: 'var(--accent)', border: 'none', borderRadius: 9, fontFamily: 'var(--font-bebas)', fontSize: 15, letterSpacing: '0.06em', color: '#0A0A0A', cursor: connecting ? 'wait' : 'pointer', opacity: connecting ? 0.7 : 1 }}>
                  {connecting ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE'}
                </button>
                <button onClick={handleSaveCreds}
                  style={{ padding: '11px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'var(--font-bebas)', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }}>
                  SAVE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Fallback: Gemini API Key ── */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 15, color: 'var(--text)', letterSpacing: '0.06em', marginBottom: 4 }}>GEMINI API KEY (FALLBACK)</div>
          <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.5 }}>
            Used if Vertex AI is not connected. Free key at <span style={{ color: 'var(--accent)' }}>aistudio.google.com</span>
          </p>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input
              type={showGemini ? 'text' : 'password'}
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              style={{ ...inputStyle, paddingRight: 44 }}
            />
            <button onClick={() => setShowGemini(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}>
              {showGemini ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleSaveGemini}
            style={{ padding: '9px 18px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'var(--font-bebas)', fontSize: 14, color: 'var(--text-2)', cursor: 'pointer' }}>
            {savedMsg === 'Saved' ? 'SAVED ✓' : 'SAVE'}
          </button>
        </div>

        {/* ── Set type guide ── */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 15, color: 'var(--text)', letterSpacing: '0.06em', marginBottom: 12 }}>SET TYPE GUIDE</div>
          {[
            { label: 'N', color: '#888',    bg: '#1E1E1E',                   name: 'Normal',   desc: 'Standard working set' },
            { label: 'W', color: '#FFAA00', bg: 'rgba(255,170,0,0.12)',      name: 'Warmup',   desc: 'Lighter prep set, shorter rest' },
            { label: 'D', color: '#6366f1', bg: 'rgba(99,102,241,0.12)',     name: 'Dropset',  desc: 'Reduce weight between drops, no rest — tap ↓ to add more drops' },
            { label: 'H', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',     name: 'Half Rep', desc: 'Partial range of motion — supports multiple weight/rep combos' },
            { label: 'F', color: '#FF4444', bg: 'rgba(255,68,68,0.12)',      name: 'Failure',  desc: 'Train to muscular failure, max rest' },
          ].map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderTop: t.label !== 'N' ? '1px solid var(--border)' : 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: t.bg, color: t.color, border: `1px solid ${t.color}33`, fontFamily: 'var(--font-jetbrains)', fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{t.label}</span>
              <div>
                <span style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{t.name}  </span>
                <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-3)' }}>{t.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {savedMsg && savedMsg !== 'Saved' && (
          <div style={{ padding: '10px 14px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 10, color: 'var(--success)', fontFamily: 'var(--font-dm-sans)', fontSize: 13, textAlign: 'center' }}>
            {savedMsg}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ user, onStartWorkout, onLogout }: {
  user: User
  onStartWorkout: () => void
  onLogout: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
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
          style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
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

      {settingsOpen && createPortal(<SettingsPanel onClose={() => setSettingsOpen(false)} />, document.body)}

      {/* Settings row */}
      <div className="fade-up-4" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Settings size={16} color="var(--text-2)" />
          </div>
          <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 15, color: 'var(--text)', flex: 1, textAlign: 'left' }}>Settings</span>
          <ChevronRight size={16} color="var(--text-3)" />
        </button>
      </div>

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
