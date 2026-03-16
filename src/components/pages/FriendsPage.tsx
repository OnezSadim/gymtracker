'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, Users, Plus, X, Copy, Check, LogIn, Crown, Dumbbell, Flame, ChevronRight, ArrowLeft } from 'lucide-react'
import {
  fetchUserGroups, createBattleGroup, joinBattleGroup, leaveGroup,
  fetchGroupLeaderboard, updateUsername,
  type BattleGroup, type GroupMember,
} from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// ── Score legend ──────────────────────────────────────────────────────────────

const SCORE_RULES = [
  { pts: '+10', desc: 'per workout this week', icon: '💪' },
  { pts: '+15', desc: 'bonus for 3+ workouts', icon: '🔥' },
  { pts: '+10', desc: 'bonus for 5+ workouts', icon: '⚡' },
]

function scoreTier(points: number): { label: string; color: string } {
  if (points >= 65) return { label: 'ELITE', color: '#C8FF00' }
  if (points >= 45) return { label: 'GRINDER', color: '#f97316' }
  if (points >= 25) return { label: 'ACTIVE', color: '#6366f1' }
  return { label: 'ROOKIE', color: '#888' }
}

// ── LeaderboardView ───────────────────────────────────────────────────────────

function LeaderboardView({ group, currentUserId, onBack }: {
  group: BattleGroup
  currentUserId: string
  onBack: () => void
}) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    fetchGroupLeaderboard(group.id).then(m => { setMembers(m); setLoading(false) })
  }, [group.id])

  const copyCode = () => {
    navigator.clipboard.writeText(group.invite_code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return
    setLeaving(true)
    await leaveGroup(group.id, currentUserId)
    onBack()
  }

  const myRank = members.findIndex(m => m.user_id === currentUserId)
  const me = members[myRank]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: 24, letterSpacing: '0.08em', color: 'var(--text)', flex: 1 }}>{group.name.toUpperCase()}</h2>
          <button onClick={handleLeave} disabled={leaving} style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            Leave
          </button>
        </div>

        {/* Invite code */}
        <button onClick={copyCode} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Invite Code — Share with friends</div>
            <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 26, color: 'var(--accent)', letterSpacing: '0.18em', filter: 'drop-shadow(0 0 6px var(--accent-glow))' }}>{group.invite_code}</div>
          </div>
          {copied ? <Check size={18} color="var(--success)" /> : <Copy size={16} color="var(--text-2)" />}
        </button>
      </div>

      <div className="page-scroll" style={{ flex: 1, padding: '12px 16px 32px' }}>
        {/* My score card */}
        {me && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, boxShadow: '0 0 16px var(--accent-dim)' }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>YOUR SCORE THIS WEEK</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 48, color: 'var(--accent)', lineHeight: 1, letterSpacing: '0.04em', filter: 'drop-shadow(0 0 10px var(--accent-glow))' }}>{me.points}</span>
                <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 16, color: 'var(--text-2)', marginLeft: 4 }}>PTS</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: scoreTier(me.points).color, fontWeight: 600, letterSpacing: '0.08em' }}>{scoreTier(me.points).label}</div>
                <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-2)' }}>{me.weeklyWorkouts} workout{me.weeklyWorkouts !== 1 ? 's' : ''} this week</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', marginBottom: 4 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 20, color: 'var(--text-2)' }}>#{myRank + 1}</div>
                <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: 'var(--text-3)' }}>rank</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 10 }}>LEADERBOARD · THIS WEEK</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontFamily: 'var(--font-dm-sans)', fontSize: 13 }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {members.map((member, i) => {
              const isMe = member.user_id === currentUserId
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const tier = scoreTier(member.points)

              return (
                <div key={member.user_id} style={{
                  background: isMe ? 'rgba(200,255,0,0.06)' : 'var(--surface)',
                  border: `1px solid ${isMe ? 'rgba(200,255,0,0.2)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* Rank */}
                  <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                    {medal ? (
                      <span style={{ fontSize: 18 }}>{medal}</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 14, color: 'var(--text-3)' }}>#{i + 1}</span>
                    )}
                  </div>

                  {/* Name + tier */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 16, color: isMe ? 'var(--accent)' : 'var(--text)', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.username}{isMe ? ' (you)' : ''}
                      </span>
                      {i === 0 && <Crown size={12} color="#C8FF00" />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: tier.color, letterSpacing: '0.06em' }}>{tier.label}</span>
                      <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: 'var(--text-3)' }}>
                        {member.weeklyWorkouts}× this week
                      </span>
                    </div>
                  </div>

                  {/* Points */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 22, color: isMe ? 'var(--accent)' : 'var(--text)', letterSpacing: '0.04em', lineHeight: 1 }}>{member.points}</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em' }}>PTS</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Score guide */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 10 }}>HOW POINTS WORK</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SCORE_RULES.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--accent)', fontWeight: 600, width: 28 }}>{r.pts}</span>
                <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 13, color: 'var(--text-2)' }}>{r.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Scores reset every Monday. All-time total: {members.find(m => m.user_id === currentUserId)?.totalWorkouts ?? 0} workouts.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FriendsPage ───────────────────────────────────────────────────────────────

interface FriendsPageProps {
  user: User | null
}

export default function FriendsPage({ user }: FriendsPageProps) {
  const [groups, setGroups] = useState<BattleGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<BattleGroup | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  const loadGroups = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const g = await fetchUserGroups(user.id)
    setGroups(g)
    setLoading(false)
  }, [user])

  useEffect(() => { loadGroups() }, [loadGroups])

  const handleCreate = async () => {
    if (!createName.trim() || !user) return
    setActionLoading(true)
    setActionError('')
    const group = await createBattleGroup(createName.trim(), user.id, user.email ?? undefined)
    if (group) {
      setGroups(prev => [...prev, group])
      setSelectedGroup(group)
      setShowCreate(false)
      setCreateName('')
    } else {
      setActionError('Failed to create group')
    }
    setActionLoading(false)
  }

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return
    setActionLoading(true)
    setActionError('')
    const result = await joinBattleGroup(joinCode.trim(), user.id)
    if (result.success) {
      await loadGroups()
      setShowJoin(false)
      setJoinCode('')
    } else {
      setActionError(result.error || 'Failed to join')
    }
    setActionLoading(false)
  }

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return
    await updateUsername(user.id, displayName.trim())
    setEditingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  if (!user) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, textAlign: 'center' }}>
        <Trophy size={44} color="var(--text-3)" />
        <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, color: 'var(--text-2)', letterSpacing: '0.08em' }}>BATTLE MODE</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>Sign in from the Home tab to compete with friends and track who's most consistent at the gym.</p>
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '14px 16px', width: '100%', maxWidth: 280 }}>
          <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 10 }}>SCORING</div>
          {SCORE_RULES.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{r.icon}</span>
              <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--accent)', width: 28 }}>{r.pts}</span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-2)' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Show selected group leaderboard
  if (selectedGroup) {
    return (
      <LeaderboardView
        group={selectedGroup}
        currentUserId={user.id}
        onBack={() => { setSelectedGroup(null); loadGroups() }}
      />
    )
  }

  // Main view
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: 28, letterSpacing: '0.1em', color: 'var(--text)', marginBottom: 2 }}>BATTLE</h1>
        <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--text-3)' }}>Compete with friends. Points reset weekly.</p>
      </div>

      <div className="page-scroll" style={{ flex: 1, padding: '12px 16px 40px' }}>
        {/* Display name */}
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Your display name</div>
          {editingName ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                placeholder="Enter name..." autoFocus
                style={{ flex: 1, fontFamily: 'var(--font-bebas)', fontSize: 18, color: 'var(--text)', background: 'transparent', letterSpacing: '0.06em' }} />
              <button onClick={handleSaveName} style={{ padding: '4px 12px', background: 'var(--accent)', border: 'none', borderRadius: 7, fontFamily: 'var(--font-bebas)', fontSize: 13, color: '#0A0A0A', cursor: 'pointer' }}>SAVE</button>
              <button onClick={() => setEditingName(false)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => { setEditingName(true); setDisplayName(user.email?.split('@')[0] || '') }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontFamily: 'var(--font-bebas)', fontSize: 20, color: nameSaved ? 'var(--success)' : 'var(--text)', letterSpacing: '0.06em' }}>
                {user.email?.split('@')[0] || 'Set your name'}
              </span>
              <span style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: 'var(--text-3)' }}>{nameSaved ? '✓ saved' : '(tap to edit)'}</span>
            </button>
          )}
        </div>

        {/* Groups */}
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 13, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 10 }}>
          MY GROUPS · {groups.length}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            {groups.length === 0 && !showCreate && !showJoin && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6, marginBottom: 16 }}>
                No groups yet.<br />Create one or join with an invite code.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {groups.map(g => (
                <button key={g.id} onClick={() => setSelectedGroup(g)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid rgba(200,255,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={18} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-bebas)', fontSize: 17, color: 'var(--text)', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name.toUpperCase()}</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginTop: 2 }}>CODE: {g.invite_code}</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-3)" />
                </button>
              ))}
            </div>

            {/* Create group form */}
            {showCreate && (
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--accent)', padding: '12px 14px', marginBottom: 10, boxShadow: '0 0 10px var(--accent-dim)' }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>New Group Name</div>
                <input value={createName} onChange={e => setCreateName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="e.g. Powerhouse Squad" autoFocus
                  style={{ width: '100%', fontFamily: 'var(--font-bebas)', fontSize: 18, color: 'var(--text)', background: 'transparent', letterSpacing: '0.06em', marginBottom: 10 }} />
                {actionError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{actionError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleCreate} disabled={!createName.trim() || actionLoading} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 8, fontFamily: 'var(--font-bebas)', fontSize: 15, color: '#0A0A0A', cursor: 'pointer', letterSpacing: '0.06em' }}>
                    {actionLoading ? '...' : 'CREATE'}
                  </button>
                  <button onClick={() => { setShowCreate(false); setActionError('') }} style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                </div>
              </div>
            )}

            {/* Join group form */}
            {showJoin && (
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>6-Character Invite Code</div>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="ABC123" maxLength={6} autoFocus
                  style={{ width: '100%', fontFamily: 'var(--font-bebas)', fontSize: 26, color: 'var(--accent)', background: 'transparent', letterSpacing: '0.2em', marginBottom: 10 }} />
                {actionError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{actionError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleJoin} disabled={joinCode.length !== 6 || actionLoading} style={{ flex: 1, padding: '10px', background: joinCode.length === 6 ? 'var(--accent)' : 'var(--surface-2)', border: 'none', borderRadius: 8, fontFamily: 'var(--font-bebas)', fontSize: 15, color: joinCode.length === 6 ? '#0A0A0A' : 'var(--text-3)', cursor: 'pointer', letterSpacing: '0.06em' }}>
                    {actionLoading ? '...' : 'JOIN'}
                  </button>
                  <button onClick={() => { setShowJoin(false); setActionError('') }} style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        {!showCreate && !showJoin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowCreate(true); setShowJoin(false); setActionError('') }}
              style={{ flex: 1, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-bebas)', fontSize: 15, color: '#0A0A0A', letterSpacing: '0.06em' }}>
              <Plus size={16} strokeWidth={2.5} />CREATE
            </button>
            <button onClick={() => { setShowJoin(true); setShowCreate(false); setActionError('') }}
              style={{ flex: 1, padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-bebas)', fontSize: 15, color: 'var(--text)', letterSpacing: '0.06em' }}>
              <LogIn size={16} />JOIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
