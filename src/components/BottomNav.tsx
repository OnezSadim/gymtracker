'use client'

import { Dumbbell, Home, History } from 'lucide-react'

const TABS = [
  { icon: Dumbbell, label: 'Workout', page: 0 },
  { icon: Home,     label: 'Home',    page: 1 },
  { icon: History,  label: 'History', page: 2 },
]

interface BottomNavProps {
  currentPage: number
  onNavigate: (page: number) => void
  activeWorkout?: boolean
}

export default function BottomNav({ currentPage, onNavigate, activeWorkout }: BottomNavProps) {
  return (
    <div className="bottom-nav">
      {/* Frosted separator line */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      <div
        style={{
          display: 'flex',
          background: 'rgba(10,10,10,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        {TABS.map(({ icon: Icon, label, page }) => {
          const active = currentPage === page
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0 8px',
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Active top bar */}
              <div
                style={{
                  position: 'absolute',
                  top: -9,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: active ? 32 : 0,
                  height: 2,
                  background: 'var(--accent)',
                  borderRadius: 2,
                  transition: 'width 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  boxShadow: active ? '0 0 8px var(--accent-glow)' : 'none',
                }}
              />

              {/* Icon */}
              <div style={{ position: 'relative' }}>
                <Icon
                  size={22}
                  strokeWidth={active ? 2 : 1.5}
                  color={active ? 'var(--accent)' : 'var(--text-2)'}
                  style={{
                    transition: 'color 0.2s, transform 0.2s',
                    transform: active ? 'translateY(-1px)' : 'none',
                    filter: active ? 'drop-shadow(0 0 6px var(--accent-glow))' : 'none',
                  }}
                />
                {/* Active workout indicator dot */}
                {label === 'Workout' && activeWorkout && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -4,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--success)',
                      boxShadow: '0 0 6px var(--success)',
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontFamily: 'var(--font-dm-sans)',
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--accent)' : 'var(--text-3)',
                  letterSpacing: '0.03em',
                  transition: 'color 0.2s',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
