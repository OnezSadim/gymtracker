'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import SwipeContainer from '@/components/SwipeContainer'
import WorkoutPage from '@/components/pages/WorkoutPage'
import HomePage from '@/components/pages/HomePage'
import HistoryPage from '@/components/pages/HistoryPage'
import { getSupabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [activeWorkout, setActiveWorkout] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)   // start at Home (middle)

  // Restore session on mount
  useEffect(() => {
    const sb = getSupabase()
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check localStorage for active workout on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gymtracker_active_workout')
      setActiveWorkout(!!saved)
    } catch {}
  }, [])

  const handleLogin = useCallback((u: User) => setUser(u), [])
  const handleLogout = useCallback(() => setUser(null), [])
  const handleNavigateToWorkout = useCallback(() => setCurrentPage(0), [])
  const handleWorkoutStatusChange = useCallback((active: boolean) => setActiveWorkout(active), [])

  const pages = [
    <WorkoutPage
      key="workout"
      user={user}
      onWorkoutStatusChange={handleWorkoutStatusChange}
    />,
    <HomePage
      key="home"
      user={user}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onNavigateToWorkout={handleNavigateToWorkout}
    />,
    <HistoryPage
      key="history"
      user={user}
    />,
  ]

  return (
    <SwipeContainer
      pages={pages}
      initialPage={1}
      externalPage={currentPage}
      activeWorkout={activeWorkout}
    />
  )
}
