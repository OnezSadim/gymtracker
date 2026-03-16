'use client'

import {
  useRef, useState, useCallback, useEffect,
  type ReactNode, type TouchEvent,
} from 'react'
import BottomNav from './BottomNav'

interface SwipeContainerProps {
  pages: ReactNode[]           // [Workout, Home, History]
  initialPage?: number         // default 1 (Home)
  activeWorkout?: boolean
  externalPage?: number        // controlled from parent
}

const SWIPE_THRESHOLD = 50     // px
const DRAG_RESISTANCE = 0.3   // applied at boundary pages

export default function SwipeContainer({
  pages,
  initialPage = 1,
  activeWorkout,
  externalPage,
}: SwipeContainerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)

  // Sync with external page changes (e.g. "Start Workout" button)
  useEffect(() => {
    if (externalPage !== undefined && externalPage !== currentPage) {
      goToPage(externalPage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPage])
  const [dragOffset, setDragOffset] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isDraggingHorizontally = useRef<boolean | null>(null)
  const currentPageRef = useRef(currentPage)

  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

  const goToPage = useCallback((page: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, page))
    setIsTransitioning(true)
    setDragOffset(0)
    setCurrentPage(target)
    setTimeout(() => setIsTransitioning(false), 320)
  }, [pages.length])

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isDraggingHorizontally.current = null
    setIsTransitioning(false)
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Determine direction on first significant movement
    if (isDraggingHorizontally.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isDraggingHorizontally.current = Math.abs(dx) > Math.abs(dy)
    }

    if (!isDraggingHorizontally.current) return

    // Apply resistance at boundaries
    const page = currentPageRef.current
    let offset = dx
    if ((page === 0 && dx > 0) || (page === pages.length - 1 && dx < 0)) {
      offset = dx * DRAG_RESISTANCE
    }

    setDragOffset(offset)
  }, [pages.length])

  const onTouchEnd = useCallback(() => {
    if (!isDraggingHorizontally.current) return
    const page = currentPageRef.current

    if (dragOffset < -SWIPE_THRESHOLD && page < pages.length - 1) {
      goToPage(page + 1)
    } else if (dragOffset > SWIPE_THRESHOLD && page > 0) {
      goToPage(page - 1)
    } else {
      // Snap back
      setIsTransitioning(true)
      setDragOffset(0)
      setTimeout(() => setIsTransitioning(false), 320)
    }
    isDraggingHorizontally.current = null
  }, [dragOffset, pages.length, goToPage])

  // Dynamic widths based on page count
  const n = pages.length
  const pageWidthPct = 100 / n            // % of container per page
  const containerWidthPct = n * 100       // container is n * 100vw
  const translateX = `calc(${-currentPage * pageWidthPct}% + ${dragOffset}px)`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: 'var(--bg)',
        paddingBottom: 74,
      }}
    >
      {/* Pages container */}
      <div
        ref={containerRef}
        className={isTransitioning ? 'transitioning' : ''}
        style={{
          display: 'flex',
          width: `${containerWidthPct}%`,
          height: '100%',
          willChange: 'transform',
          transform: `translateX(${translateX})`,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {pages.map((page, i) => (
          <div key={i} style={{ width: `${pageWidthPct}%`, height: '100%', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
            {page}
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <BottomNav
        currentPage={currentPage}
        onNavigate={goToPage}
        activeWorkout={activeWorkout}
      />
    </div>
  )
}
